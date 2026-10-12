# meritasep.com

The Meritas Equity Partners website. Static single-page site, no build step.

| File | What it is |
|---|---|
| `index.html` | The entire site — HTML, CSS, JS and images (base64-embedded) in one file |
| `CNAME` | Tells GitHub Pages the custom domain is meritasep.com |
| `.nojekyll` | Stops GitHub Pages running Jekyll over the files |
| `favicon.ico`, `favicon-32.png`, `favicon-512.png`, `apple-touch-icon.png` | Browser and mobile icons |
| `og-image.png` | Link-preview card for LinkedIn, email, iMessage |
| `scorecard/index.html` | Exit Readiness Scorecard (meritasep.com/scorecard/), a free lead-capture quiz; results email via FormSubmit |
| `robots.txt`, `sitemap.xml` | Search engine directives |
| `investors/` | Investor Room (meritasep.com/investors/): gated, view-only deck room with view tracking |
| `investors/admin/` | Room admin: add/revoke investors, upload decks, see who viewed what |

## Investor Room

Login, private files and tracking run on Supabase (project `gthdplsmifonoxricvvp`), because this repo is public and GitHub Pages can't gate anything.

- **Never put a deck PDF or image in this repo.** Decks are uploaded through `/investors/admin/`; the browser turns each page into an image and stores it in Supabase's private `decks` bucket. The PDF itself is never uploaded.
- Login is an emailed one-time code / magic link. Anyone can request one, but only emails on the investor list (and granted a deck) see anything; this is enforced by the database (`investors/setup.sql`), not the page.
- Admins: sfarrell@ and spearce@meritasep.com (the `admins` table).
- Viewing: pages are drawn on a canvas with the viewer's email + date watermarked across them. Right-click, drag, Ctrl/Cmd+S/P and printing are blocked. Screenshots can't be stopped; the watermark makes a leak traceable.
- Tracking: each open is a session; the viewer pings time-on-page every 10s while the tab is visible and active (idle >2 min stops the clock).
- `investors/config.js` holds the Supabase URL and anon key. Both are public by design. Never put the service_role key in this repo.
- `investors/setup.sql` is the full database setup; safe to re-run.

## How edits work

1. Claude edits `index.html` and commits to `main`.
2. GitHub Pages rebuilds automatically on push.
3. The change is live at meritasep.com in about a minute.

No build, no dependencies. Editing the file *is* deploying.

## Brand reference

- Ink `#14120f` / Paper `#fbf9f5` / Gold `#c9a227` (bright `#deb649`) / Stone `#6b6559`
- Serif Fraunces, Sans Archivo, Mono IBM Plex Mono (via Google Fonts)
- Tile motif: five squares, first two solid ink and gold, remaining three faded

## Section anchors

`#top` `#pe` `#realestate` `#advisory` `#team` `#philosophy` `#news` `#contact`

## Hosting

- Domain registrar and DNS: WordPress.com (`ns1/ns2/ns3.wordpress.com`)
- Host: GitHub Pages, served from `main` branch root
- Apex A records: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
- Email: Google Workspace (MX -> aspmx.l.google.com) - never touch the MX or TXT records
- Contact form: opens the visitor's mail client addressed to info@meritasep.com
- Contact: info@meritasep.com
