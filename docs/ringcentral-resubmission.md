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

**Mixed** (Customer Care plus Marketing).

If RingCentral requires a single selection and Mixed is unavailable, select
**Marketing** — it is the stricter category and covers the rest.

### Campaign description

> Spartan Shield Insurance is an independent property and casualty insurance
> agency licensed in Kentucky, Indiana, and Ohio. We send text messages to
> consumers who have requested a quote, hold a policy through our agency, or
> have otherwise asked us to contact them. Messages cover new business quoting,
> policy servicing and endorsements, billing and payment reminders, claims
> intake and status updates, appointment scheduling, and day to day
> correspondence with their assigned agent. Consumers who separately opt in to
> marketing also receive renewal reminders, coverage review offers, and agency
> news, limited to 6 messages per month.

### How consent is collected

> Consumers opt in through two separate, unchecked, optional checkboxes on the
> public contact form at https://spartanshieldins.com/contact. One checkbox
> covers service messages and one covers marketing messages. Neither is a
> condition of purchase. Both checkbox labels include the brand name Spartan
> Shield Insurance, message frequency, "message and data rates may apply," HELP
> and STOP instructions, and links to the Privacy Policy at
> https://spartanshieldins.com/privacy and the SMS Terms and Conditions at
> https://spartanshieldins.com/sms-terms. Consumers may also opt in verbally
> during a call with a licensed agent using a scripted disclosure, or by texting
> the agency first.

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

These two strings are rendered on `/contact` character for character. If a
reviewer compares the campaign submission to the live page, they will match.

**Checkbox 1 — service messages** (id `consent_service`, unchecked, not
required):

> I agree to receive text messages from Spartan Shield Insurance at the mobile
> number provided, about quotes, policies, billing, claims, and service
> requests. Message frequency varies. Message and data rates may apply. Reply
> HELP for help or STOP to opt out at any time. See our Privacy Policy and SMS
> Terms and Conditions.

**Checkbox 2 — marketing messages** (id `consent_marketing`, unchecked, not
required):

> I agree to receive marketing and promotional text messages from Spartan
> Shield Insurance at the mobile number provided, including renewal reminders,
> coverage review offers, and agency news. Up to 6 messages per month. Message
> and data rates may apply. Reply HELP for help or STOP to opt out at any time.
> Consent is not a condition of purchase. See our Privacy Policy and SMS Terms
> and Conditions.

On the live page, "Privacy Policy" and "SMS Terms and Conditions" are hyperlinks
to `/privacy` and `/sms-terms`.

---

## Required automated replies

### Opt-in confirmation

> Spartan Shield Insurance: You are subscribed. Msg frequency varies, up to 6
> marketing msgs/month. Msg & data rates may apply. Reply HELP for help, STOP to
> cancel.

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

## Verbal opt-in script for agents

The campaign description above states that verbal opt-in is one of the
channels, so reviewers sometimes ask to see the script. Agents should use this
wording:

> "Before we finish, is it alright if we text you at this number about your
> quote, your policy, and service items? Message frequency varies, message and
> data rates may apply, and you can reply STOP any time to opt out. And
> separately, would you like occasional texts about renewal offers and coverage
> reviews, up to six a month? That one is optional and not required to buy a
> policy."

**Agents must log both answers with the date**, in the agency management system.
An unlogged verbal consent is the same as no consent if it is ever challenged.

---

## How each rejection code is answered

| Code | Rejection | Where it is fixed |
|---|---|---|
| CR4015 | Call to action missing or inaccessible | `/contact` form, linked from top-level nav, footer, and the Privacy Policy. Publicly reachable, no login. |
| CR4002 | CTA missing registered/DBA brand name | Both consent labels name "Spartan Shield Insurance". Every page footer declares the trade name relationship. |
| CR4001 | Insufficient consent | Two separate, unchecked, non-required checkboxes. Service and marketing consent are independent. |
| CR4003 | No HELP instructions | Both checkbox labels, `/sms-terms` §6, the Privacy Policy §4, and the footer. |
| CR4004 | No STOP instructions | Both checkbox labels, `/sms-terms` §5, the Privacy Policy §4, and the footer. |
| CR4005 | No message frequency disclosure | Service: "Message frequency varies." Marketing: "Up to 6 messages per month." Both labels and `/sms-terms` §3. |
| CR4006 | No message and data rates disclosure | Both labels, `/sms-terms` §4, Privacy Policy §4. |
| CR4007 | No complete terms or link to terms | Both labels link to `/privacy` and `/sms-terms`. `/sms-terms` is a standalone URL with all ten sections. |

---

## One thing that is not about the website

The campaign description says messages go to people who requested a quote or
hold a policy. **That is only true going forward.** The site collects consent
from new inbound contacts; the existing book has no consent record.

Texting existing clients because they are clients is the single most common way
an approved campaign gets shut down later. The first outreach to the current
book should be **a call or an email asking them to opt in — not a text.**
