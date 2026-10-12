-- =====================================================================
-- Meritas Investor Room — Supabase setup
-- Run once: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run (idempotent).
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

-- Who can run the room (add decks, add investors, see analytics)
create table if not exists public.admins (
  email text primary key check (email = lower(email))
);

insert into public.admins (email) values
  ('sfarrell@meritasep.com'),
  ('spearce@meritasep.com')
on conflict do nothing;

-- Who is allowed into the room at all
create table if not exists public.investors (
  email       text primary key check (email = lower(email)),
  name        text,
  firm        text,
  active      boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Each deck = a set of page images in the private "decks" storage bucket
create table if not exists public.decks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text,
  page_count  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Which investor can see which deck
create table if not exists public.deck_access (
  deck_id     uuid not null references public.decks(id) on delete cascade,
  email       text not null references public.investors(email) on delete cascade on update cascade,
  granted_at  timestamptz not null default now(),
  primary key (deck_id, email)
);

-- One row each time someone opens a deck
create table if not exists public.view_sessions (
  id            uuid primary key default gen_random_uuid(),
  deck_id       uuid not null references public.decks(id) on delete cascade,
  email         text not null,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  seconds       int not null default 0,
  user_agent    text
);

-- Time spent on each page within a session
create table if not exists public.page_views (
  session_id  uuid not null references public.view_sessions(id) on delete cascade,
  deck_id     uuid not null references public.decks(id) on delete cascade,
  email       text not null,
  page        int  not null,
  seconds     int  not null default 0,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  primary key (session_id, page)
);

create index if not exists view_sessions_deck_idx  on public.view_sessions(deck_id, started_at desc);
create index if not exists view_sessions_email_idx on public.view_sessions(email, started_at desc);
create index if not exists page_views_deck_idx     on public.page_views(deck_id, page);

-- ---------- Helper functions -----------------------------------------

create or replace function public.me() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = public.me())
$$;

create or replace function public.can_view_deck(d uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
    from public.deck_access a
    join public.investors i on i.email = a.email and i.active
    join public.decks k     on k.id = a.deck_id and k.active
    where a.deck_id = d and a.email = public.me()
  )
$$;

-- ---------- Tracking RPCs (the only way viewers write anything) -------

create or replace function public.start_view(p_deck uuid, p_ua text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public.can_view_deck(p_deck) then
    raise exception 'not allowed';
  end if;
  insert into public.view_sessions (deck_id, email, user_agent)
  values (p_deck, public.me(), left(p_ua, 300))
  returning id into sid;
  return sid;
end $$;

-- Called every few seconds by the viewer: "I've been on page N for S more seconds"
create or replace function public.log_page(p_session uuid, p_page int, p_seconds int)
returns void
language plpgsql security definer set search_path = public as $$
declare s public.view_sessions;
        secs int := greatest(0, least(coalesce(p_seconds, 0), 60));  -- cap each ping at 60s
begin
  select * into s from public.view_sessions where id = p_session;
  if s.id is null or s.email <> public.me() then
    raise exception 'not your session';
  end if;
  if not public.can_view_deck(s.deck_id) then
    raise exception 'access revoked';
  end if;

  insert into public.page_views (session_id, deck_id, email, page, seconds)
  values (p_session, s.deck_id, s.email, p_page, secs)
  on conflict (session_id, page)
  do update set seconds = page_views.seconds + excluded.seconds, last_seen = now();

  update public.view_sessions
     set seconds = seconds + secs, last_seen_at = now()
   where id = p_session;
end $$;

-- ---------- Row-level security ---------------------------------------

alter table public.admins        enable row level security;
alter table public.investors     enable row level security;
alter table public.decks         enable row level security;
alter table public.deck_access   enable row level security;
alter table public.view_sessions enable row level security;
alter table public.page_views    enable row level security;

-- Clear old versions of the policies so this file can be re-run
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('admins','investors','decks','deck_access','view_sessions','page_views')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

-- admins: admins can read the list
create policy admins_read on public.admins for select using (public.is_admin());

-- investors: admins manage; an investor can read their own row
create policy investors_admin on public.investors for all
  using (public.is_admin()) with check (public.is_admin());
create policy investors_self on public.investors for select
  using (email = public.me());

-- decks: admins manage; investors see only decks granted to them
create policy decks_admin on public.decks for all
  using (public.is_admin()) with check (public.is_admin());
create policy decks_viewer on public.decks for select
  using (public.can_view_deck(id));

-- deck_access: admins manage; investors see their own grants
create policy access_admin on public.deck_access for all
  using (public.is_admin()) with check (public.is_admin());
create policy access_self on public.deck_access for select
  using (email = public.me());

-- tracking: read-only for admins; viewers write only through the RPCs above
create policy sessions_admin on public.view_sessions for select using (public.is_admin());
create policy sessions_admin_del on public.view_sessions for delete using (public.is_admin());
create policy pages_admin    on public.page_views    for select using (public.is_admin());

grant execute on function public.start_view(uuid, text)    to authenticated;
grant execute on function public.log_page(uuid, int, int)  to authenticated;
grant execute on function public.is_admin()                to authenticated;
grant execute on function public.can_view_deck(uuid)       to authenticated;
revoke execute on function public.start_view(uuid, text)   from anon;
revoke execute on function public.log_page(uuid, int, int) from anon;

-- ---------- Private storage for deck pages ---------------------------
-- Files live at  decks/<deck-id>/<page>.jpg  and are never public.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('decks', 'decks', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false;

drop policy if exists "decks read"   on storage.objects;
drop policy if exists "decks write"  on storage.objects;
drop policy if exists "decks update" on storage.objects;
drop policy if exists "decks delete" on storage.objects;

create policy "decks read" on storage.objects for select to authenticated
  using (
    bucket_id = 'decks'
    and public.can_view_deck( ((storage.foldername(name))[1])::uuid )
  );
create policy "decks write"  on storage.objects for insert to authenticated
  with check (bucket_id = 'decks' and public.is_admin());
create policy "decks update" on storage.objects for update to authenticated
  using (bucket_id = 'decks' and public.is_admin());
create policy "decks delete" on storage.objects for delete to authenticated
  using (bucket_id = 'decks' and public.is_admin());

-- ---------- Analytics views for the admin panel -----------------------

create or replace view public.deck_activity
with (security_invoker = true) as
select
  s.deck_id,
  s.email,
  i.name,
  i.firm,
  count(distinct s.id)                       as opens,
  sum(s.seconds)                             as total_seconds,
  max(s.last_seen_at)                        as last_viewed,
  min(s.started_at)                          as first_viewed,
  (select count(distinct p.page) from public.page_views p
    where p.deck_id = s.deck_id and p.email = s.email) as pages_seen
from public.view_sessions s
left join public.investors i on i.email = s.email
group by s.deck_id, s.email, i.name, i.firm;

create or replace view public.page_heat
with (security_invoker = true) as
select deck_id, page,
       count(distinct email) as viewers,
       sum(seconds)          as total_seconds
from public.page_views
group by deck_id, page;
