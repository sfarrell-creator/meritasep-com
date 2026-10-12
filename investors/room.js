/* Meritas Investor Room — shared client code (sign-in, page rendering, watermarking). */
(function(){
  var cfg = window.ROOM_CONFIG || {};
  var Room = window.Room = {};

  Room.configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  Room.sb = Room.configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
  }) : null;
  Room.cfg = cfg;

  Room.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  Room.$ = function(sel, root){ return (root || document).querySelector(sel); };
  Room.toast = function(msg){
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 2600);
  };
  Room.fmtDur = function(sec){
    sec = Math.round(sec || 0);
    if (sec < 60) return sec + 's';
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return m + 'm ' + (s ? s + 's' : '');
    return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  };
  Room.fmtWhen = function(ts){
    if (!ts) return '—';
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, { month:'short', day:'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' });
  };

  /* ---------- Auth ---------- */
  Room.session = null;
  Room.email = function(){ return Room.session && Room.session.user ? String(Room.session.user.email || '').toLowerCase() : ''; };

  Room.init = async function(onChange){
    if (!Room.configured) { onChange(null); return; }
    var r = await Room.sb.auth.getSession();
    Room.session = r.data.session;
    // Clean the magic-link tokens out of the address bar
    if (/access_token=|error_description=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    onChange(Room.session);
    Room.sb.auth.onAuthStateChange(function(evt, s){
      var was = Room.email(); Room.session = s;
      if (evt === 'TOKEN_REFRESHED') return;
      if (was !== Room.email()) onChange(s);
    });
  };

  Room.sendCode = function(email, redirectPath){
    return Room.sb.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: location.origin + (redirectPath || location.pathname), shouldCreateUser: true }
    });
  };
  Room.verifyCode = function(email, token){
    return Room.sb.auth.verifyOtp({ email: email, token: token, type: 'email' });
  };
  Room.signOut = async function(){ await Room.sb.auth.signOut(); location.hash = ''; location.reload(); };

  /* Renders the shared sign-in card into `el`. */
  Room.renderSignIn = function(el, opts){
    opts = opts || {};
    var base = opts.base || '';
    el.innerHTML =
      '<div class="auth">' +
        '<section class="auth-art dark">' +
          '<div class="photo" style="background-image:url(' + base + 'assets/waterford.jpg)"></div>' +
          '<div class="stack" style="gap:20px">' +
            '<div class="tiles" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>' +
            '<span class="eyebrow">' + Room.esc(opts.eyebrow || 'Investor Room') + '</span>' +
            '<h1>' + (opts.titleHtml || 'The deals we’re working on, <em>up close</em>.') + '</h1>' +
            '<p class="lede">' + Room.esc(opts.lede || 'This is where we share the full picture with the people investing alongside us in Buffalo Niagara buildings and businesses. The numbers, the plan, and how we’ll run it.') + '</p>' +
          '</div>' +
          '<ul class="points">' +
            '<li>Sign in with a code we email you. No password.</li>' +
            '<li>Everything opens right here. Nothing to download.</li>' +
            '<li>Every page carries your name, so it stays between us.</li>' +
          '</ul>' +
        '</section>' +
        '<section class="auth-form"><div class="stack">' +
          '<form class="stack" id="emailForm" novalidate style="gap:20px">' +
            '<div class="stack" style="gap:8px"><h2>Sign in</h2><p class="fine">Use the email your invite came to.</p></div>' +
            '<div><label for="em">Email</label><input type="email" id="em" autocomplete="email" required placeholder="you@company.com"></div>' +
            '<button class="btn gold block" type="submit">Send my code →</button>' +
            '<p class="err" id="emErr" hidden></p>' +
          '</form>' +
          '<form class="stack" id="codeForm" hidden novalidate style="gap:20px">' +
            '<div class="stack" style="gap:8px"><h2>Check your inbox</h2><p class="fine">We sent a sign-in link to <strong id="sentTo" style="color:var(--ink)"></strong>. Click it, or type the code from the email here.</p></div>' +
            '<div><label for="cd">Sign-in code</label><input type="text" id="cd" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="••••••"></div>' +
            '<button class="btn block" type="submit">Open the room</button>' +
            '<p class="err" id="cdErr" hidden></p>' +
            '<button class="btn link" type="button" id="restart" style="justify-self:start">Wrong email? Start over</button>' +
          '</form>' +
          '<p class="fine" style="border-top:1px solid var(--hairline);padding-top:18px">The room is invite only. Want a look at what we’re working on? Reach us at <a href="mailto:' + Room.esc(cfg.CONTACT_EMAIL) + '">' + Room.esc(cfg.CONTACT_EMAIL) + '</a>.</p>' +
        '</div></section>' +
      '</div>';
    var email = '';
    var emailForm = Room.$('#emailForm', el), codeForm = Room.$('#codeForm', el);
    emailForm.addEventListener('submit', async function(e){
      e.preventDefault();
      var err = Room.$('#emErr', el); err.hidden = true;
      email = Room.$('#em', el).value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'That doesn’t look like an email address.'; err.hidden = false; return; }
      var b = emailForm.querySelector('button'); b.disabled = true; b.textContent = 'Sending…';
      var r = await Room.sendCode(email, opts.redirectPath);
      b.disabled = false; b.textContent = 'Send my code →';
      if (r.error) {
        err.textContent = /rate|seconds/i.test(r.error.message) ? 'Too many tries. Give it a minute and try again.' : 'We couldn’t send the email. Try again, or reach us at ' + cfg.CONTACT_EMAIL + '.';
        err.hidden = false; return;
      }
      Room.$('#sentTo', el).textContent = email;
      emailForm.hidden = true; codeForm.hidden = false; Room.$('#cd', el).focus();
    });
    codeForm.addEventListener('submit', async function(e){
      e.preventDefault();
      var err = Room.$('#cdErr', el); err.hidden = true;
      var code = Room.$('#cd', el).value.replace(/\D/g, '');
      if (code.length < 6) { err.textContent = 'Type the code from the email.'; err.hidden = false; return; }
      var b = codeForm.querySelector('button[type=submit]'); b.disabled = true;
      var r = await Room.verifyCode(email, code);
      b.disabled = false;
      if (r.error) { err.textContent = 'That code didn’t work or it expired. Start over to get a new one.'; err.hidden = false; }
    });
    Room.$('#restart', el).addEventListener('click', function(){ codeForm.hidden = true; emailForm.hidden = false; });
  };

  /* ---------- Pages: fetch privately, draw with watermark ---------- */
  var bitmaps = new Map();   // "deck/page" -> Promise<ImageBitmap>

  Room.pagePath = function(deckId, n){ return deckId + '/' + n + '.jpg'; };

  Room.loadPage = function(deckId, n){
    var key = deckId + '/' + n;
    if (bitmaps.has(key)) return bitmaps.get(key);
    var p = (async function(){
      var r = await Room.sb.storage.from('decks').createSignedUrl(Room.pagePath(deckId, n), 60);
      if (r.error) throw r.error;
      var res = await fetch(r.data.signedUrl, { cache: 'no-store', credentials: 'omit' });
      if (!res.ok) throw new Error('page ' + n + ' unavailable');
      var blob = await res.blob();
      return await createImageBitmap(blob);
    })();
    p.catch(function(){ bitmaps.delete(key); });
    bitmaps.set(key, p);
    return p;
  };
  Room.forget = function(deckId){
    bitmaps.forEach(function(v, k){ if (k.indexOf(deckId + '/') === 0) { v.then(function(b){ b.close && b.close(); }).catch(function(){}); bitmaps.delete(k); } });
  };

  // Draws the page plus a tiled, diagonal watermark naming the viewer.
  Room.draw = function(canvas, bmp, mark, opts){
    opts = opts || {};
    var w = bmp.width, h = bmp.height;
    canvas.width = w; canvas.height = h;
    var c = canvas.getContext('2d');
    c.drawImage(bmp, 0, 0, w, h);
    if (!mark) return;
    var fs = Math.max(14, Math.round(w / 52));
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(-Math.PI / 7);
    c.font = '500 ' + fs + 'px "IBM Plex Mono", ui-monospace, monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    var stepX = Math.max(c.measureText(mark).width + fs * 4, w / 3), stepY = fs * 6;
    var span = Math.hypot(w, h);
    for (var y = -span / 2, row = 0; y < span / 2; y += stepY, row++) {
      for (var x = -span / 2 + (row % 2 ? stepX / 2 : 0); x < span / 2; x += stepX) {
        c.fillStyle = 'rgba(20,18,15,0.075)'; c.fillText(mark, x, y);
        c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillText(mark, x + 1, y + 1);
      }
    }
    c.restore();
    if (opts.footer !== false) {
      var fh = Math.max(11, Math.round(w / 110));
      c.font = '500 ' + fh + 'px "IBM Plex Mono", ui-monospace, monospace';
      c.textAlign = 'right'; c.textBaseline = 'bottom';
      var txt = 'CONFIDENTIAL · ' + mark.toUpperCase();
      var tw = c.measureText(txt).width;
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(w - tw - fh * 2, h - fh * 2.4, tw + fh * 2, fh * 2.4);
      c.fillStyle = 'rgba(20,18,15,0.7)'; c.fillText(txt, w - fh, h - fh * 0.7);
    }
  };

  Room.watermarkText = function(){
    var d = new Date();
    return Room.email() + ' · ' + d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  };

  /* Discourage saving, printing and dragging inside an element. */
  Room.lockDown = function(el){
    ['contextmenu','dragstart','copy','cut','selectstart'].forEach(function(t){ el.addEventListener(t, function(e){ e.preventDefault(); }); });
  };
  document.addEventListener('keydown', function(e){
    if (!document.querySelector('.viewer:not([hidden])')) return;
    var k = (e.key || '').toLowerCase();
    if ((e.metaKey || e.ctrlKey) && (k === 's' || k === 'p' || k === 'c')) { e.preventDefault(); Room.toast('Saving and printing are turned off for these materials.'); }
  }, true);
})();
