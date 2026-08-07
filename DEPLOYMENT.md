# Deployment and DNS cutover runbook

Written for Sam. Part A sets up the Cloudflare resources the site needs. Part B
is the DNS cutover, which is the part that can break your email if it is done
carelessly.

Read Part B in full before you start it.

---

## Part A — Cloudflare resources

Do all of this before the DNS cutover. None of it affects the live site or your
email.

### A1. Create the Pages project

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**
2. Select the repository.
3. Build settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: leave blank if the repo root is the project; set it to the
     project folder if the site lives in a subdirectory.
4. Deploy. You get a `*.pages.dev` URL. The site will work, but the two forms
   will fail until A2 and A3 are done.

### A2. Create the D1 database

```bash
npx wrangler d1 create spartan-shield
```

Copy the `database_id` it prints into `wrangler.toml`, replacing
`REPLACE_AFTER_RUNNING_WRANGLER_D1_CREATE`. Commit that change — a database id
is not a secret.

Then create the tables:

```bash
npm run db:migrate:remote
```

### A3. Create the R2 bucket

```bash
npx wrangler r2 bucket create spartan-shield-resumes
```

**Do not enable public access on this bucket.** Resumes are served only through
`/api/admin/resume/:id`, which checks the Access token first. A public bucket
would put applicant resumes on the open internet.

### A4. Turnstile (spam protection)

1. Cloudflare dashboard → **Turnstile** → **Add site**
2. Domain: `spartanshieldins.com` (add `localhost` too if you want to test)
3. Widget mode: **Managed**
4. Copy both keys into the Pages project under **Settings → Variables and
   Secrets**:
   - `PUBLIC_TURNSTILE_SITE_KEY` — plain text
   - `TURNSTILE_SECRET_KEY` — click **Encrypt**

**Until `TURNSTILE_SECRET_KEY` is set, form spam checking is skipped.** The
forms still work; they are just unprotected. Set it before launch.

### A5. Cloudflare Access for the admin page

This replaces a password. Nobody has to remember or share anything.

1. Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** →
   **Add an application** → **Self-hosted**
2. Application name: `Spartan Shield admin`
3. Session duration: 24 hours
4. Application domain: `spartanshieldins.com`, path `careers/admin*`
5. **Add a second domain entry** on the same application: `spartanshieldins.com`,
   path `api/admin*`. Without this the page is protected but the API behind it
   is only protected by its own JWT check — belt and braces.
6. Identity providers: **One-time PIN**
7. Policy:
   - Name: `Owners`
   - Action: **Allow**
   - Include → **Emails** → `sam@spartanshieldins.com` and
     `nick@spartanshieldins.com`
8. Save. Open the application's **Overview** tab and copy the
   **Application Audience (AUD) Tag**.
9. In the Pages project → Settings → Variables and Secrets, add:
   - `CF_ACCESS_AUD` — the AUD tag
   - `CF_ACCESS_TEAM_DOMAIN` — e.g. `spartanshield.cloudflareaccess.com`
     (Zero Trust → Settings → Custom Pages shows your team domain)

To sign in: go to `/careers/admin`, enter your email, receive a six-digit code
by email, enter it. To revoke someone later, remove their email from the policy.

**If either variable is missing, every admin API call returns an error rather
than falling open.** That is deliberate.

### A6. Email notifications (Resend)

Optional but strongly recommended — without it, leads sit in the dashboard
unseen until someone thinks to check.

1. Create an account at resend.com and add the domain
   **`send.spartanshieldins.com`**.

   Use that subdomain, not the root domain. Verifying the root would mean
   touching the DNS records your Microsoft 365 email depends on. The subdomain
   is isolated.

2. Add the SPF and DKIM records Resend gives you, on the **subdomain**, in
   Cloudflare DNS. Set them to **DNS only** (grey cloud).
3. Create an API key.
4. In the Pages project → Settings → Variables and Secrets:
   - `RESEND_API_KEY` — click **Encrypt**
   - `NOTIFY_EMAILS` — `sam@spartanshieldins.com,nick@spartanshieldins.com`
   - `NOTIFY_FROM` — `notifications@send.spartanshieldins.com`
   - `ENABLE_EMAIL_NOTIFY` — `true`

Set `ENABLE_EMAIL_NOTIFY` to `false` at any time to turn notifications off
without a code change.

### A7. Redeploy

Environment variables are read at request time for Functions but the Turnstile
**site** key is baked into the client bundle at build time. After setting
`PUBLIC_TURNSTILE_SITE_KEY`, trigger a fresh deploy so it takes effect.

### A8. Test on the `*.pages.dev` URL before touching DNS

- Submit the contact form with **both consent boxes unchecked** — it must
  succeed
- Submit it again with both checked
- Apply with a real PDF
- Try to apply with a `.png` and with a file over 5 MB — both must be refused
- Open `/careers/admin`, sign in, confirm both tabs load and the resume
  downloads
- Open `/api/admin/applications` in a private window — it must refuse you

---

## Part B — DNS cutover

**The risk to manage:** their business email runs on Microsoft 365 through DNS
records on this domain. A careless nameserver change drops mail. Every step
below exists to prevent that.

### Step 1 — Inventory, before touching anything

In Squarespace, open Domains, select spartanshieldins.com, open DNS Settings,
and screenshot every record. Confirm the screenshot includes:

- The MX record, typically `spartanshieldins-com.mail.protection.outlook.com`,
  priority 0
- The SPF TXT record, typically
  `v=spf1 include:spf.protection.outlook.com -all`
- Two DKIM CNAMEs, `selector1._domainkey` and `selector2._domainkey`
- The `autodiscover` CNAME pointing to `autodiscover.outlook.com`
- Any `_dmarc` TXT record
- Any domain verification TXT records, including `MS=ms########`

Do not proceed until every one of these is captured. If any are missing from
the screenshot, they are missing from the plan.

### Step 2 — Add the domain to Cloudflare

Create a free Cloudflare account, add spartanshieldins.com. Cloudflare scans and
imports existing records. Compare its import against the Step 1 screenshot
record by record. Manually add anything it missed. Set every mail record (MX,
TXT, DKIM CNAMEs, autodiscover) to **DNS only**, the grey cloud. Proxying mail
records breaks mail.

### Step 3 — Deploy Pages

Connect the GitHub repository to Cloudflare Pages. Build command
`npm run build`, output directory `dist`. Verify the site on the `*.pages.dev`
preview URL. Sam approves here, before any DNS change.

### Step 4 — Lower TTLs and wait

Set TTL to 5 minutes on records in Cloudflare, then wait one hour. This
shortens the rollback window if anything goes wrong.

### Step 5 — Flip the nameservers

In Squarespace, change the domain's nameservers to the two Cloudflare assigned.
Propagation is usually under an hour, up to 24.

### Step 6 — Verify, in this order

1. Send a test email from an outside address to sam@ and confirm delivery
2. Send an outbound email from sam@ to an outside address and confirm it does
   not land in spam, which would indicate SPF or DKIM failure
3. Confirm Outlook desktop and mobile still connect
4. Load the site at both spartanshieldins.com and www.spartanshieldins.com
5. Confirm HTTPS with a valid certificate on both

### Step 7 — Attach the custom domain in Pages

Attach the custom domain in Pages and confirm the redirect from www to apex.

### Rollback

Revert the nameservers in Squarespace. Because the original records still exist
there, this restores the previous state within the TTL window.

### Step 8 — After launch

- Update the Google Business Profile website field to the new URL
- Point the RingCentral campaign at the new domain
- Leave the old aggregator page live for two weeks, then ask AAI to redirect or
  remove it

---

## Post-launch checklist

- [ ] `TURNSTILE_SECRET_KEY` is set (otherwise the forms are unprotected)
- [ ] `CF_ACCESS_AUD` and `CF_ACCESS_TEAM_DOMAIN` are set
- [ ] The R2 bucket does **not** have public access enabled
- [ ] `ENABLE_EMAIL_NOTIFY` is `true` and a test submission arrives in both
      inboxes
- [ ] Carrier logo files are in `public/carriers/` (see README)
- [ ] Review text is filled in in `src/data/reviews.json`
- [ ] Headshots are in `public/team/`
- [ ] Job descriptions approved by Nick and Sam
- [ ] Privacy policy and SMS terms reviewed by counsel or the E&O carrier
- [ ] RingCentral brand profile lists "Spartan Shield Insurance" as a DBA on the
      Spartan Shield Corp. brand record
