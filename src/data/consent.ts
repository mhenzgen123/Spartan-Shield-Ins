/**
 * SMS CONSENT LANGUAGE — DO NOT EDIT WITHOUT READING THIS.
 *
 * This string is the single source of truth for two things at once:
 *
 *   1. The checkbox label rendered on /contact
 *   2. The consent language pasted into the RingCentral / TCR campaign
 *      submission (docs/ringcentral-resubmission.md)
 *
 * If the site copy and the campaign description diverge by even one clause,
 * the A2P 10DLC campaign is denied. The first submission was rejected on eight
 * codes, seven of which were call-to-action failures. Keeping one source
 * prevents a repeat.
 *
 * CHANGED 2026-08-13, at the client's direction: this was two separate
 * checkboxes (service consent and marketing consent). It is now ONE combined
 * consent whose wording covers marketing *and* customer care messages. If you
 * ever split it again, split it in this file and the form follows
 * automatically — do not add a second checkbox in markup.
 *
 * Every element below is load-bearing for a specific TCR rejection code:
 *
 *   CR4002  the brand name "Spartan Shield Insurance" appears verbatim
 *   CR4003  "Reply HELP for help"
 *   CR4004  "STOP to opt out at any time"
 *   CR4005  message frequency ("Up to 6 messages per month")
 *   CR4006  "Message and data rates may apply."
 *   CR4007  links to /privacy and /sms-terms
 *   CR4001  an unchecked, non-required checkbox, plus
 *           "Consent is not a condition of purchase"
 *
 * Rules enforced elsewhere in the codebase, restated here so they are not
 * lost: the checkbox renders UNCHECKED, does not carry `required`, and no
 * script pre-selects it. The form must submit successfully with it unchecked.
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

/**
 * The one consent checkbox on /contact. Its wording covers marketing and
 * customer care messages together, so a single tick grants both.
 */
export const consentSms: ConsentCheckbox = {
  id: "consent_sms",
  name: "consent_sms",
  text:
    "I agree to receive marketing and promotional text messages from Spartan Shield Insurance at " +
    "the mobile number provided, including renewal reminders, coverage review offers, and customer " +
    "care messages. Up to 6 messages per month. Message and data rates may apply. Reply HELP for " +
    "help or STOP to opt out at any time. Consent is not a condition of purchase. See our Privacy " +
    "Policy and SMS Terms and Conditions.",
  links: [PRIVACY, SMS_TERMS],
};

/** Eyebrow above the bordered consent container on /contact. */
export const consentEyebrow = "TEXT MESSAGING (OPTIONAL)";

/**
 * Split a consent string into text and link segments so the label can be
 * rendered with real anchors without ever retyping the copy into markup.
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
    "Spartan Shield Insurance: You are subscribed. Up to 6 msgs/month. " +
    "Msg & data rates may apply. Reply HELP for help, STOP to cancel.",
  help:
    "Spartan Shield Insurance: For help, call (502) 308-4382 or email sam@spartanshieldins.com. " +
    "Msg & data rates may apply. Reply STOP to cancel.",
  stop:
    "Spartan Shield Insurance: You are unsubscribed and will receive no further messages. " +
    "Reply START to resubscribe.",
} as const;
