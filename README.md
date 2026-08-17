# meritasep.com

The Meritas Equity Partners website. Static single-page site, no build step.

| File | What it is |
|---|---|
| `index.html` | The entire site — HTML, CSS, JS and images (base64-embedded) in one file |
| `CNAME` | Tells GitHub Pages the custom domain is meritasep.com |
| `.nojekyll` | Stops GitHub Pages running Jekyll over the files |
| `favicon.ico`, `favicon-32.png`, `favicon-512.png`, `apple-touch-icon.png` | Browser and mobile icons |
| `og-image.png` | Link-preview card for LinkedIn, email, iMessage |
| `robots.txt`, `sitemap.xml` | Search engine directives |

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
