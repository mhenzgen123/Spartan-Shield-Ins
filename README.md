# Spartan Shield Insurance — website

Marketing site for Spartan Shield Insurance (a registered trade name of Spartan
Shield Corp.), an independent property and casualty brokerage in Louisville,
Kentucky.

**Stack:** Astro 7 (static) · Tailwind CSS 4 · Cloudflare Pages · Pages
Functions · D1 · R2 · Cloudflare Access

---

## What this site is for

Two jobs, in priority order:

1. **Pass A2P 10DLC campaign review** so the agency can text clients from
   RingCentral. The previous submission was denied on eight codes, seven of
   which were "call to action" failures — meaning there was no publicly
   reachable place for a consumer to opt in to texting. `/contact` is that
   place. **Read [Compliance](#compliance-read-before-editing-contact) before
   touching that page.**
2. **Look credible enough to recruit** experienced sales and service talent.

Lead generation is third. The owners want inbound calls and texts, not a queue
of form fills — which is why the phone number, not a quote form, is the hero of
every page.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321 — pages only, no Functions
```

`astro dev` serves the static pages but **not** the Pages Functions, so the two
forms will fail. To run the whole thing, including D1 and R2:

```bash
npm run build
npx wrangler d1 execute spartan-shield --local --file=./migrations/0001_init.sql   # once
npx wrangler pages dev --port 8788
```

That gives you working `/api/contact` and `/api/apply` against a local SQLite
D1 and a local R2 directory under `.wrangler/`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Astro dev server (no Functions) |
| `npm run build` | Static build to `dist/` |
| `npm run preview` | Serve `dist/` (no Functions) |
| `npm run check` | Astro + TypeScript check on `src/` |
| `npm run check:functions` | TypeScript check on `functions/` |
| `npm run check:all` | Both of the above |
| `npm run assets` | Regenerate the OG image and touch icon |
| `npm run db:migrate:local` | Apply migrations to the local D1 |
| `npm run db:migrate:remote` | Apply migrations to the production D1 |

`src/` and `functions/` have separate `tsconfig.json` files on purpose: the
Functions run in the Workers runtime and need `@cloudflare/workers-types`, which
must not leak into browser code.

---

## Where to deploy

**Cloudflare Pages is the real target.** It is what `DEPLOYMENT.md` sets up, and
it is the only host where the whole site works — the contact form, the job
application, D1, R2, and Cloudflare Access all depend on Pages Functions.
Connect the repo, build `npm run build`, output `dist`, and you get a working
`*.pages.dev` URL before you touch DNS.

**GitHub Pages is available as a preview only.** `.github/workflows/github-pages.yml`
builds and publishes on every push to `main` once you set
Settings → Pages → Source → "GitHub Actions". Be clear about what it gives you:

| | Cloudflare Pages | GitHub Pages |
|---|---|---|
| Pages render, design reviewable | yes | yes |
| Consent block visible for a TCR reviewer | yes | yes |
| Contact form **submits** | yes | **no** |
| Application form + resume upload | yes | **no** |
| Admin dashboard + Access | yes | **no** |

So GitHub Pages is fine for "let me see the site". It is not enough for the A2P
campaign, because a reviewer following the flow needs a form that actually
works — and it is not enough to collect a single real lead.

### Base path

A GitHub Pages *project* site is served from `/<repo-name>/`, not the root.
Astro rewrites the asset URLs it generates, but not hrefs written by hand, so
every internal href, image `src`, and fetch path goes through the `url()` helper
in `src/data/site.ts`. The workflow sets `PUBLIC_BASE_PATH` and
`PUBLIC_SITE_URL` from `actions/configure-pages`; both default to a root
deployment, so Cloudflare is unaffected.

If you add a new internal link, use `url("/somewhere")` rather than a bare
`href="/somewhere"`, or it will 404 on the GitHub Pages preview. To test:

```bash
PUBLIC_BASE_PATH=/Spartan-Shield-Ins npm run build
```

## Environment variables

Copy `.env.example` to `.env` for local work. In production these live in the
Cloudflare dashboard. **No secret is ever committed** — `.env` and `.dev.vars`
are gitignored.

Two of them change behaviour by their absence, deliberately:

- **`TURNSTILE_SECRET_KEY` unset** → spam verification is skipped and the forms
  still work. Convenient in development, unacceptable in production. Set it.
- **`CF_ACCESS_AUD` / `CF_ACCESS_TEAM_DOMAIN` unset** → every admin API call
  fails with an error. Admin endpoints serve applicant PII, so they fail closed,
  never open.

See `.env.example` for the full list and `DEPLOYMENT.md` for where each value
comes from.

---

## Compliance — read before editing `/contact`

The consent block on the contact page is the artifact the whole A2P campaign
depends on. Each rule below maps to a specific rejection code.

| Rule | Why |
|---|---|
| Both checkboxes render **unchecked** on load and after a failed validation | CR4001 |
| Neither checkbox is **required**; the form submits with both unchecked | CR4001 |
| The two consents are **independent** — service and marketing are separate | CR4001 |
| Labels name **"Spartan Shield Insurance"** verbatim | CR4002 |
| Labels contain HELP instructions | CR4003 |
| Labels contain STOP instructions | CR4004 |
| Labels state frequency ("varies" / "up to 6 per month") | CR4005 |
| Labels state "Message and data rates may apply." | CR4006 |
| Labels link to `/privacy` and `/sms-terms` | CR4007 |
| `/contact` is in the top-level nav, one click from the homepage, no login | CR4015 |

**The label text lives in exactly one place: `src/data/consent.ts`.** It is
imported into the form and must be pasted unchanged into the RingCentral
campaign submission (see `docs/ringcentral-resubmission.md`). If the site copy
and the campaign description differ by even one clause, the campaign is denied.
Never retype consent copy into markup.

Every submission stores the **full label text** on the row, not just a boolean.
If the wording is later revised, historical records still show exactly what a
given person agreed to on that date. That is the TCPA defence.

The footer carries the STOP/HELP line and the trade name declaration on every
page. Both are load-bearing. Do not remove them.

---

## Project structure

```
src/
├── components/          Astro components + three React islands
│   ├── PhoneDisplay.astro    the signature element
│   ├── MeanderRule.astro     Greek key hairline divider
│   ├── ContactForm.tsx       island — carries the consent block
│   ├── ApplicationForm.tsx   island — resume upload
│   └── AdminDashboard.tsx    island — behind Cloudflare Access
├── data/
│   ├── site.ts          EVERY verified fact, single source of truth
│   ├── consent.ts       exact SMS consent strings
│   ├── carriers.json    carrier logo manifest
│   ├── reviews.json     Google reviews (client fills the text)
│   ├── roles.json       open roles (DRAFT, pending owner approval)
│   └── coverage.ts      homepage coverage cards
├── layouts/BaseLayout.astro
├── pages/
└── styles/tokens.css    design tokens, type scale, components, motion
functions/
├── _lib/                env, validation, Turnstile, Access JWT, Resend
└── api/
    ├── contact.ts       public
    ├── apply.ts         public
    └── admin/           all behind a verified Access JWT
migrations/0001_init.sql
```

**No phone number, license number, email address, or street address is typed
literally into a component.** Everything imports from `src/data/site.ts`. When a
number changes, it changes once.

### Interactivity budget

Only four things ship JavaScript. Everything else is static HTML and CSS.

1. Mobile navigation toggle (a plain script, not a framework)
2. Contact form
3. Application form
4. Admin dashboard

No carousel library, no animation library, no UI component library. Please keep
it that way.

---

## Placeholders the client still needs to fill

These render as visible, labelled placeholders rather than fake content. Each
one appears automatically once the real asset lands — no code change needed.

### Headshots → `public/team/` — DONE

Supplied by the client on 2026-08-11. 750x900 portraits, served as `.webp`
with a `.jpg` fallback. The cards use a 5:6 frame, which is exactly 750:900, so
the photos fill it with no cropping at all.

To replace one, drop in a new `<slug>-750.jpg` (and optionally `-750.webp`) at
the same 5:6 ratio. If the `.jpg` is missing the card falls back to a monogram
placeholder rather than a broken image.

### Carrier logos → `public/carriers/` — DONE

Eleven logos supplied by the client on 2026-08-11 and rendering in the
homepage carousel: Travelers, Liberty Mutual, Chubb, Nationwide, Progressive,
Geico, Safeco, National General, The Hartford, Openly, Grange.

They were trimmed of surrounding white padding so each mark renders at a usable
size. The artwork itself is untouched — no recolour, no crop into the mark, no
filters — which is what appointment agreements require.

To add or remove one: drop the file in `public/carriers/` and edit
`src/data/carriers.json`. The build warns about any entry whose file is missing
and skips it rather than rendering a broken image.

### Review text → `src/data/reviews.json` — DONE

Three reviews supplied by the client, transcribed verbatim from the Google
Business Profile. **Do not reword them** — paraphrasing a review is dishonest
and violates Google's policies. To swap one out, replace the whole entry.
Bylines are first name + last initial, set per entry via `display`.

### Office map → `public/map-office.png`

A static map image, 800×450. Deliberately an image and not an embedded iframe —
an embed costs a third-party cookie banner and a large script for a picture of a
building.

### Logo mark → `src/components/Logo.astro`

The current mark is a clean vector interpretation of the shield roundel from the
supplied artwork. Replace the paths in that component with the exported
production vector, keeping `fill="currentColor"` so it keeps tinting correctly
in the header, footer, and on light sections.

---

## Open items and flagged assumptions

| Item | Status | Owner |
|---|---|---|
| Job descriptions | **DRAFT, not approved.** Written from the brief. | Nick and Sam |
| Compensation | Omitted per instruction. Published ranges materially improve applicant quality; worth reconsidering. | Nick and Sam |
| Privacy policy and SMS terms | Drafted to carrier and TCR requirements **by a non-lawyer**. Have counsel or the E&O carrier review before launch. | Sam |
| Founding year | Copy says "founded 2025", based on the trade name registration date of 2025-06-09. Verify before launch. | Sam |
| Google rating and review count | Hardcoded as 5.0 / 23 (August 2026). Not fetched live. Update quarterly in `src/data/site.ts`. | Sam |
| TCR brand DBA | Confirm "Spartan Shield Insurance" is listed as a DBA on the Spartan Shield Corp. brand record **before resubmitting**. | Sam |
| Existing book consent | No consent record exists for current clients. **Do not text them.** First outreach should be a call or an email asking them to opt in. Texting the existing book is the most common way an approved campaign gets shut down later. | Nick and Sam |
| Resend account | Needed for notifications. Requires SPF and DKIM on `send.spartanshieldins.com`. | Sam |

---

## Accessibility and quality floor

- Responsive from 320px up; verified at 320, 375, 768, 1024, 1440, 1920
- Visible keyboard focus ring (2px gold, 2px offset) on every interactive
  element
- Real `<label>` elements on every input — never placeholder-as-label
- Semantic landmarks: `header`, `nav`, `main`, `footer`, plus a skip link
- `prefers-reduced-motion: reduce` disables the hero entrance sequence entirely
- **Gold text never appears on light backgrounds** — it fails AA there. On
  parchment, emphasis is oxblood. Gold on light is permitted only for hairline
  rules and icon strokes at 2px or heavier.
- No `localStorage` or `sessionStorage` anywhere
