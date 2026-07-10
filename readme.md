# ZY-Invest — Member Portal

A private investment fund website and member portal built for GitHub Pages + Supabase.

**Live repo:** [UQ-ZhiYao/ZY-Invest-Version-2](https://github.com/UQ-ZhiYao/ZY-Invest-Version-2)

---

## File Structure

```
/
├── index.html                  ← Public home page
├── about.html                  ← About the fund
├── team.html                   ← Management team
├── login.html                  ← Member login (PWA installable)
├── manifest.webmanifest        ← PWA manifest
├── sw.js                       ← Service worker (offline / PWA)
│
├── register.html                ← New member sign-up
├── verify.html                   ← Email verification landing
│
├── assets/
│   ├── css/
│   │   ├── site.css            ← Public site stylesheet
│   │   ├── member-tokens.css   ← Desktop portal design tokens (shared)
│   │   └── member-portal.css   ← Desktop portal component/layout CSS (shared)
│   ├── img/                    ← Logo, favicon, PWA icons
│   └── js/
│       ├── supabase-auth.js    ← Supabase client + auth helpers
│       ├── api.js              ← REST API helpers + auth guards
│       ├── member-api.js       ← All Supabase data queries
│       ├── member-portal.js    ← Desktop portal shared app logic (nav, pages, charts)
│       └── site.js             ← Nav, animations, PWA transition
│
├── desktop/                     ← Each page links the shared assets above and keeps
│                                   only its own <title> + a small render-dispatch script
│   ├── dashboard.html          ← Main SPA (all pages rendered here)
│   ├── holdings.html
│   ├── transactions.html
│   ├── distributions.html
│   ├── statements.html
│   ├── fund-overview.html
│   ├── factsheet.html
│   ├── shareholders.html
│   ├── nta-history.html
│   ├── comparison.html
│   ├── financial-results.html
│   ├── settings.html
│   ├── indices.html            ← Coming soon
│   ├── watchlist.html          ← Coming soon
│   └── instruments.html        ← Coming soon
│
└── phone/                       ← Mobile-optimised member portal
    ├── index.html               ← Mobile dashboard
    ├── login.html                ← Mobile login
    └── ... (fund.html, market.html, profile.html, transaction.html, etc.)
```

`index.html`, `login.html`, `desktop/*.html` and `phone/*.html` all share the
single root `manifest.webmanifest` and `sw.js` — there is no longer a separate
manifest/service worker per folder. Launching the installed app opens
`index.html`, which detects the device and routes into `desktop/` or `phone/`
automatically (see **PWA Install** below).

---

## GitHub Pages Deployment

1. Push the **entire contents of this folder** to your GitHub repository root
2. Go to **Settings → Pages → Branch: `main` / Root folder: `/`**
3. Site will be live at `https://<username>.github.io/<repo>/`

> **Note:** `index.html` must remain at root — GitHub Pages requires it as the entry point.

---

## API Configuration

All API keys are stored in `assets/js/`. Update these before going live:

### Supabase (`assets/js/supabase-auth.js`)
```js
var SUPABASE_URL  = 'https://your-project.supabase.co';
var SUPABASE_ANON = 'your-anon-key';
```
Get from: **Supabase Dashboard → Project Settings → API**

### REST API (`assets/js/api.js`)
```js
const API_BASE = 'https://zy-invest-api.onrender.com';
```
Replace with your deployed API URL.

### Supabase Table Schema
`member-api.js` queries these tables — ensure they exist in your Supabase project:

| Table | Purpose |
|---|---|
| `profiles` | Investor profiles + contact info |
| `nta_history` | Daily NTA values (date, nta_value) |
| `portfolios` | Holdings linked to instruments |
| `instruments` | Security master (name, ticker, sector) |
| `transactions` | Subscription / redemption records |
| `distributions` | Distribution payments per investor |
| `documents` | Fund documents + file URLs |
| `nominees` | Beneficiary nomination records |
| `subscription_requests` | Pending subs |
| `redemption_requests` | Pending redemptions |
| `fund_overview` | Single-row fund stats |
| `notifications` | Per-investor notifications |

---

## Auth Flow

```
login.html
  └── Supabase signInWithPassword()
        ├── Sets localStorage: zy_token, zy_role, zy_name, zy-session
        └── Redirects → desktop/dashboard.html (or phone/index.html on mobile)

dashboard.html (on load)
  └── Checks localStorage: zy-session OR zy_token
        ├── Missing → redirect to ../login.html
        └── Present → render portal SPA

doLogout()
  └── Clears localStorage + Supabase signOut()
        └── Redirects → ../login.html
```

---

## PWA Install

The portal is installable as a Web App on Android, iOS (Safari) and desktop Chrome/Edge.
- Android: browser shows native "Add to Home Screen" prompt on login page
- iPhone/iPad: Share button → Add to Home Screen
- Desktop: install icon in address bar

---

## Tech Stack

| Layer | Technology |
|---|---|
| Hosting | GitHub Pages (static) |
| Auth | Supabase Auth (JWT) |
| Database | Supabase (PostgreSQL) |
| API | Custom REST — Render.com |
| Fonts | DM Sans, DM Serif Display (Google Fonts) |
| PWA | Service Worker + Web App Manifest |
| No build step | Pure HTML / CSS / Vanilla JS |

---

## Brand & Design

- **Colors:** `--blue #1565C0` (primary), `--green #2E7D32` (gain), `--orange #E65100` (distribution), `--red #DC2626` (loss)
- **Fonts:** DM Sans (UI), DM Serif Display (italic accent)
- **Currency:** RM / MYR · **Dates:** DD Mon YYYY · **Locale:** `en-MY`
- **Grid:** 8pt spacing · **Radii:** 6 / 10 / 16 / 24 / 999px
- **No emoji** anywhere in the product
