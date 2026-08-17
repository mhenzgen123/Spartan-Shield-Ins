# RingCentral / TCR campaign resubmission

**For Sam. Not part of the codebase — this is copy to paste into the campaign
form.**

Every field below is written to match the live site exactly. **Do not reword
anything.** If the campaign description and the site copy diverge by even one
clause, the reviewer has grounds to deny again. The consent language here is
generated from the same source file the website renders from
(`src/data/consent.ts`), which is the whole reason it is kept in one place.

---

## Before you submit — one blocking prerequisite

Confirm that the RingCentral **brand profile** lists **Spartan Shield
Insurance** as a DBA on the **Spartan Shield Corp.** brand record. If it does
not, add it first.

This is what CR4002 was about. The consent text on the site names "Spartan
Shield Insurance"; if the brand record only knows "Spartan Shield Corp.", a
reviewer can call that a mismatch. Having the DBA on the record makes either
name acceptable.

---

## Campaign fields

### Use case

**Marketing** — or **Mixed** (Customer Care plus Marketing) if the form offers
it.

The single opt-in on the site is worded as a marketing consent that also covers
customer care messages, so Marketing is the correct and stricter selection.

### Campaign description

> Spartan Shield Insurance is an independent property and casualty insurance
> agency licensed in Kentucky, Indiana, and Ohio. We send text messages to
> consumers who have requested a quote, hold a policy through our agency, or
> have otherwise asked us to contact them. Messages cover new business quoting,
> policy servicing and endorsements, billing and payment reminders, claims
> intake and status updates, appointment scheduling, and day to day
> correspondence with their assigned agent, along with renewal reminders,
> coverage review offers, and agency news. Message volume is limited to 6
> messages per month.

### How consent is collected

> Consumers opt in through a single unchecked, optional checkbox on the public
> contact form at https://spartanshieldins.com/contact. It is not a condition of
> purchase. The checkbox label includes the brand name Spartan Shield Insurance,
> the message frequency, "message and data rates may apply," HELP and STOP
> instructions, and links to the Privacy Policy at
> https://spartanshieldins.com/privacy and the SMS Terms and Conditions at
> https://spartanshieldins.com/sms-terms.

### Call-to-action URL

`https://spartanshieldins.com/contact`

Publicly reachable, no login, linked from the top-level navigation on every
page and from the footer. One click from the homepage.

### Privacy policy URL

`https://spartanshieldins.com/privacy`

### Terms URL

`https://spartanshieldins.com/sms-terms`

---

## Consent language, exactly as it appears on the form

This string is rendered on `/contact` character for character. If a reviewer
compares the campaign submission to the live page, they will match.

**Single checkbox** (id `consent_sms`, unchecked, not required):

> I agree to receive marketing and promotional text messages from Spartan
> Shield Insurance at the mobile number provided, including renewal reminders,
> coverage review offers, and customer care messages. Up to 6 messages per
> month. Message and data rates may apply. Reply HELP for help or STOP to opt
> out at any time. Consent is not a condition of purchase. See our Privacy
> Policy and SMS Terms and Conditions.

On the live page, "Privacy Policy" and "SMS Terms and Conditions" are hyperlinks
to `/privacy` and `/sms-terms`.

---

## Required automated replies

### Opt-in confirmation

> Spartan Shield Insurance: You are subscribed. Up to 6 msgs/month. Msg & data
> rates may apply. Reply HELP for help, STOP to cancel.

### HELP response

> Spartan Shield Insurance: For help, call (502) 308-4382 or email
> sam@spartanshieldins.com. Msg & data rates may apply. Reply STOP to cancel.

### STOP response

> Spartan Shield Insurance: You are unsubscribed and will receive no further
> messages. Reply START to resubscribe.

---

## Sample messages

Each names the brand; the third carries opt-out language.

1. > Spartan Shield Insurance: Hi Jane, your auto quote came back at $118/mo
   > with full coverage. Want the full breakdown? Reply here or call
   > (502) 308-4382.

2. > Spartan Shield Insurance: We opened your claim with Travelers. Claim number
   > and adjuster contact are in your email. Reply here with questions.

3. > Spartan Shield Insurance: Your home policy renews 9/14. We re-shopped it
   > and found a better rate. Want to review? Reply STOP to opt out.

---

## A note on opt-in channels

`/sms-terms` now lists **one** opt-in method: submitting the online form. Do not
claim verbal or text-first opt-in in the campaign submission unless that section
of the site is updated to match — a reviewer comparing the two will treat any
extra channel as an unsupported claim.

If the agency does want to collect consent verbally on calls, add it back to
`/sms-terms` §2 first, then use a scripted disclosure that reads the checkbox
language aloud, and log the answer with the date in the agency management
system. An unlogged verbal consent is the same as no consent if challenged.

---

## How each rejection code is answered

| Code | Rejection | Where it is fixed |
|---|---|---|
| CR4015 | Call to action missing or inaccessible | `/contact` form, linked from top-level nav, footer, and the Privacy Policy. Publicly reachable, no login. |
| CR4002 | CTA missing registered/DBA brand name | The consent label names "Spartan Shield Insurance". Every page footer declares the trade name relationship. |
| CR4001 | Insufficient consent | An unchecked, non-required checkbox carrying "Consent is not a condition of purchase". |
| CR4003 | No HELP instructions | The checkbox label, `/sms-terms` §6, the Privacy Policy §4, and the footer. |
| CR4004 | No STOP instructions | The checkbox label, `/sms-terms` §5, the Privacy Policy §4, and the footer. |
| CR4005 | No message frequency disclosure | "Up to 6 messages per month" — on the label, `/sms-terms` §3, and the Privacy Policy §4. |
| CR4006 | No message and data rates disclosure | The label, `/sms-terms` §4, Privacy Policy §4. |
| CR4007 | No complete terms or link to terms | The label links to `/privacy` and `/sms-terms`. `/sms-terms` is a standalone URL with all ten sections. |

---

## One thing that is not about the website

The campaign description says messages go to people who requested a quote or
hold a policy. **That is only true going forward.** The site collects consent
from new inbound contacts; the existing book has no consent record.

Texting existing clients because they are clients is the single most common way
an approved campaign gets shut down later. The first outreach to the current
book should be **a call or an email asking them to opt in — not a text.**
