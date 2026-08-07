/**
 * SMS CONSENT LANGUAGE — DO NOT EDIT WITHOUT READING THIS.
 *
 * These strings are the single source of truth for two things at once:
 *
 *   1. The checkbox labels rendered on /contact
 *   2. The consent language pasted into the RingCentral / TCR campaign
 *      submission
 *
 * If the site copy and the campaign description diverge by even one clause,
 * the A2P 10DLC campaign is denied. The previous submission was rejected on
 * eight codes, seven of which were call-to-action failures. Keeping one
 * source prevents a repeat.
 *
 * Every element below is load-bearing for a specific TCR rejection code:
 *
 *   CR4002  the brand name "Spartan Shield Insurance" appears verbatim
 *   CR4003  "Reply HELP for help"
 *   CR4004  "STOP to opt out at any time"
 *   CR4005  message frequency ("varies" / "Up to 6 messages per month")
 *   CR4006  "Message and data rates may apply."
 *   CR4007  links to /privacy and /sms-terms
 *   CR4001  two independent, unchecked, non-required checkboxes
 *
 * Rules enforced elsewhere in the codebase, restated here so they are not
 * lost: both checkboxes render UNCHECKED, neither carries `required`, and no
 * script pre-selects either one. The form must submit successfully with both
 * unchecked.
 */

export interface ConsentLink {
  /** The exact substring of `text` that becomes an anchor. */
  label: string;
  href: string;
}

export interface ConsentCheckbox {
  id: string;
  name: string;
  /**
   * The complete label as one plain string. This is the value stored on every
   * submission row and the value pasted into the TCR campaign form.
   */
  text: string;
  /** Substrings of `text` to render as links. Order does not matter. */
  links: ConsentLink[];
}

const PRIVACY: ConsentLink = { label: "Privacy Policy", href: "/privacy" };
const SMS_TERMS: ConsentLink = { label: "SMS Terms and Conditions", href: "/sms-terms" };

export const consentService: ConsentCheckbox = {
  id: "consent_service",
  name: "consent_service",
  text:
    "I agree to receive text messages from Spartan Shield Insurance at the mobile number provided, " +
    "about quotes, policies, billing, claims, and service requests. Message frequency varies. " +
    "Message and data rates may apply. Reply HELP for help or STOP to opt out at any time. " +
    "See our Privacy Policy and SMS Terms and Conditions.",
  links: [PRIVACY, SMS_TERMS],
};

export const consentMarketing: ConsentCheckbox = {
  id: "consent_marketing",
  name: "consent_marketing",
  text:
    "I agree to receive marketing and promotional text messages from Spartan Shield Insurance at the " +
    "mobile number provided, including renewal reminders, coverage review offers, and agency news. " +
    "Up to 6 messages per month. Message and data rates may apply. Reply HELP for help or STOP to opt " +
    "out at any time. Consent is not a condition of purchase. See our Privacy Policy and " +
    "SMS Terms and Conditions.",
  links: [PRIVACY, SMS_TERMS],
};

export const consentCheckboxes: ConsentCheckbox[] = [consentService, consentMarketing];

/** Eyebrow above the bordered consent container on /contact. */
export const consentEyebrow = "TEXT MESSAGING (OPTIONAL)";

/**
 * Split a consent string into text and link segments so the label can be
 * rendered with real anchors without ever retyping the copy into markup.
 *
 * Used by both the Astro server render and the React island, so the two can
 * never drift apart.
 */
export type ConsentSegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

export function segmentConsent(box: ConsentCheckbox): ConsentSegment[] {
  const segments: ConsentSegment[] = [];
  let rest = box.text;

  // Walk the string left to right, always taking the earliest remaining link.
  for (;;) {
    let bestIndex = -1;
    let best: ConsentLink | null = null;

    for (const link of box.links) {
      const index = rest.indexOf(link.label);
      if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
        bestIndex = index;
        best = link;
      }
    }

    if (!best || bestIndex === -1) break;

    if (bestIndex > 0) segments.push({ type: "text", value: rest.slice(0, bestIndex) });
    segments.push({ type: "link", value: best.label, href: best.href });
    rest = rest.slice(bestIndex + best.label.length);
  }

  if (rest) segments.push({ type: "text", value: rest });
  return segments;
}

// ---------------------------------------------------------------------------
// Automated reply copy — mirrored into the RingCentral campaign submission.
// Kept here so the site and the campaign never disagree about what the agency
// sends. These are not rendered on the site; /sms-terms describes them.
// ---------------------------------------------------------------------------

export const smsAutoReplies = {
  optInConfirmation:
    "Spartan Shield Insurance: You are subscribed. Msg frequency varies, up to 6 marketing msgs/month. " +
    "Msg & data rates may apply. Reply HELP for help, STOP to cancel.",
  help:
    "Spartan Shield Insurance: For help, call (502) 308-4382 or email sam@spartanshieldins.com. " +
    "Msg & data rates may apply. Reply STOP to cancel.",
  stop:
    "Spartan Shield Insurance: You are unsubscribed and will receive no further messages. " +
    "Reply START to resubscribe.",
} as const;
