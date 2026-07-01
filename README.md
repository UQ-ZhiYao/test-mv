# ZY-Invest Member Portal

Private investment fund member portal — built for GitHub Pages deployment.

## Structure

```
/
├── index.html              ← Public home page
├── about.html              ← About the fund
├── team.html               ← Management team
├── login.html              ← Member login (PWA installable)
├── manifest.webmanifest    ← PWA manifest
├── sw.js                   ← Service worker (offline support)
├── assets/
│   ├── css/site.css        ← Public site styles
│   ├── js/                 ← Auth, API, site scripts
│   └── img/                ← Logos, icons, PWA icons
└── members/
    ├── index.html          ← Member portal (desktop SPA)
    ├── mobile.html         ← Mobile web app
    ├── mobile-login.html   ← Mobile login page
    └── pages/              ← Individual member portal pages
        ├── dashboard.html
        ├── holdings.html
        ├── transactions.html
        ├── distributions.html
        ├── statements.html
        ├── fund-overview.html
        ├── factsheet.html
        ├── shareholders.html
        ├── nta-history.html
        ├── comparison.html
        ├── financial-results.html
        ├── settings.html
        ├── indices.html        ← Coming soon
        ├── watchlist.html      ← Coming soon
        └── instruments.html    ← Coming soon
```

## GitHub Pages Setup

1. Push this folder contents to your repo root (or a `docs/` branch)
2. Go to **Settings → Pages → Branch: main / root**
3. Site will be live at `https://<username>.github.io/<repo>/`

## Configuration

Before going live, update the following in `assets/js/supabase-auth.js` and `assets/js/api.js`:

- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_ANON_KEY` — your Supabase anon key
- Table names in `assets/js/member-api.js` — match your actual schema

## PWA Install

The portal is installable as a Web App on Android, iOS (via Safari) and desktop Chrome/Edge. The install prompt appears on the login page.
