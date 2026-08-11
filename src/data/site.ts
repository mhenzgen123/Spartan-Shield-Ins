/**
 * SINGLE SOURCE OF TRUTH.
 *
 * Every verified fact from Section 2 of the build spec lives here and is
 * imported everywhere. No phone number, license number, email address, or
 * street address is ever typed literally into a component.
 *
 * When a number changes, it changes here — once.
 */

/**
 * Prefix an internal, root-relative path with the deployment base path.
 *
 * On Cloudflare Pages (and any root deployment) BASE_URL is "/" and this is a
 * no-op. On a GitHub Pages PROJECT page the site is served from
 * /<repo-name>/, and a bare href="/contact" would 404 — Astro rewrites the
 * asset URLs it generates itself, but not hrefs written by hand.
 *
 * Use this for every internal href, image src, and fetch path. External URLs
 * (http…, mailto:, tel:, sms:) and pure fragments are returned untouched.
 */
export function url(path: string): string {
  if (!path || /^([a-z]+:|\/\/|#)/i.test(path)) return path;

  const base = import.meta.env.BASE_URL || "/";
  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return `${cleanBase}${cleanPath}` || "/";
}

/** Format a 10-digit NANP string as (502) 308-4382 */
function display(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

/** Format a 10-digit NANP string as a tel: href (E.164) */
function tel(raw: string): string {
  return `tel:+1${raw.replace(/\D/g, "")}`;
}

/** Format a 10-digit NANP string as an sms: href */
function sms(raw: string): string {
  return `sms:+1${raw.replace(/\D/g, "")}`;
}

export interface Phone {
  /** Digits only */
  raw: string;
  /** (502) 308-4382 */
  display: string;
  /** tel:+15023084382 */
  tel: string;
  /** sms:+15023084382 */
  sms: string;
}

function phone(raw: string): Phone {
  return { raw: raw.replace(/\D/g, ""), display: display(raw), tel: tel(raw), sms: sms(raw) };
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export const legalName = "Spartan Shield Corp.";
export const brandName = "Spartan Shield Insurance";
export const shortName = "Spartan Shield";

/**
 * Required on every page footer, the privacy policy, and the SMS terms.
 * Satisfies TCR code CR4002 regardless of which name is on the brand record.
 */
export const tradeNameDeclaration =
  "Spartan Shield Insurance is a registered trade name of Spartan Shield Corp.";

export const entityType = "Kentucky Corporation";
export const kentuckySosNumber = "1453094";
export const registeredAgent = "Samuel Genuis";

export const tagline = "Independent insurance brokers. Louisville, Kentucky.";

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

export const mainPhone = phone("5023084382");

/**
 * Office address. Updated August 2026 — the agency moved from 1400 Envoy
 * Circle (Suite 1408, 40299) to Townepark Circle.
 *
 * NOTE: `geo` is intentionally absent. The old coordinates belonged to the
 * Envoy Circle address and would now be wrong, and guessing at replacements
 * would put a false location in the structured data and on Google. Get the
 * real ones from the Google Business Profile (or right-click the pin in Google
 * Maps → the first number is latitude), add them back here, and the
 * InsuranceAgency JSON-LD will start emitting a `geo` block again
 * automatically.
 */
export const address = {
  street: "209 Townepark Cir",
  suite: "Ste 100",
  city: "Louisville",
  state: "KY",
  stateName: "Kentucky",
  zip: "40243",
  country: "US",
  /** 209 Townepark Cir, Ste 100, Louisville, KY 40243 */
  oneLine: "209 Townepark Cir, Ste 100, Louisville, KY 40243",
  geo: null as { latitude: number; longitude: number } | null,
} as const;

export const hours = {
  /** Human-readable, used in copy */
  display: "Monday to Friday, 8:00 AM to 6:00 PM. Closed Saturday and Sunday.",
  /** Short form for the hero micro-line and header */
  short: "Monday to Friday, 8am to 6pm ET",
  /** schema.org openingHours */
  schema: "Mo-Fr 08:00-18:00",
  opens: "08:00",
  closes: "18:00",
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
} as const;

// ---------------------------------------------------------------------------
// Licensing
// ---------------------------------------------------------------------------

export const kentuckyLicense = "1398478";
export const npn = "21580784";

export const licensedStates = [
  { code: "KY", name: "Kentucky" },
  { code: "IN", name: "Indiana" },
  { code: "OH", name: "Ohio" },
] as const;

/** "Kentucky, Indiana, and Ohio" */
export const licensedStatesSentence = "Kentucky, Indiana, and Ohio";

/** Used beneath the leadership cards and in the footer bottom bar. */
export const licensingLine = `${legalName} · Kentucky license ${kentuckyLicense} · NPN ${npn} · Licensed in ${licensedStatesSentence}`;

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export interface Leader {
  slug: string;
  name: string;
  /** Uppercase, for the Marcellus display treatment */
  displayName: string;
  title: string;
  phone: Phone;
  email: string;
  headshot: string;
  headshotAlt: string;
}

export const leaders: Leader[] = [
  {
    slug: "sam-genuis",
    name: "Sam Genuis",
    displayName: "SAM GENUIS",
    title: "Co-Founder / Broker",
    phone: phone("5023083026"),
    email: "sam@spartanshieldins.com",
    headshot: "/team/sam-genuis",
    headshotAlt: "Sam Genuis, Co-Founder and Broker at Spartan Shield Insurance",
  },
  {
    slug: "nick-henzgen",
    name: "Nick Henzgen",
    displayName: "NICK HENZGEN",
    title: "Co-Founder / Broker",
    phone: phone("5023083490"),
    email: "nick@spartanshieldins.com",
    headshot: "/team/nick-henzgen",
    headshotAlt: "Nick Henzgen, Co-Founder and Broker at Spartan Shield Insurance",
  },
];

/** Primary contact for HELP responses and privacy requests. */
export const primaryEmail = "sam@spartanshieldins.com";

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
//
// NOTE: The Google rating and review count are hardcoded deliberately — the
// spec does not require a live Places API call. THESE NEED PERIODIC MANUAL
// UPDATE. Check the Google Business Profile quarterly and edit the two values
// below. Retrieved August 2026.

export const google = {
  rating: 5.0,
  ratingDisplay: "5.0",
  reviewCount: 23,
  placeId: "ChIJEzz86mihaYgRCj_GWKP4-F4",
  reviewsUrl:
    "https://search.google.com/local/reviews?placeid=ChIJEzz86mihaYgRCj_GWKP4-F4",
  profileUrl:
    "https://www.google.com/maps/place/?q=place_id:ChIJEzz86mihaYgRCj_GWKP4-F4",
} as const;

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------

export const siteUrl = "https://spartanshieldins.com";

export const nav = [
  { label: "Home", href: "/" },
  { label: "Leadership", href: "/leadership" },
  { label: "About Us", href: "/about" },
  { label: "Hiring", href: "/hiring" },
  { label: "Contact", href: "/contact" },
] as const;

export const legalNav = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "SMS Terms and Conditions", href: "/sms-terms" },
] as const;

/** Lines of business written. */
export const linesOfBusiness = ["Auto", "Home", "Renters", "Commercial / Business"] as const;

/** Rendered from a constant so the date does not drift between the two legal pages. */
export const legalLastUpdated = "August 7, 2026";

export const copyright = `© ${new Date().getFullYear()} ${legalName} All rights reserved.`;

/** The full legal bottom-bar disclosure. */
export const footerDisclosure = `© 2026 ${legalName} All rights reserved. ${tradeNameDeclaration} Kentucky license ${kentuckyLicense} · NPN ${npn}. Licensed in ${licensedStatesSentence}. Coverage is subject to policy terms, conditions, and carrier underwriting approval. This site is for informational purposes and does not constitute an offer of insurance.`;
