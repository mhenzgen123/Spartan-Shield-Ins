import {
  badRequest,
  json,
  methodNotAllowed,
  newId,
  nowIso,
  serverError,
  type Env,
} from "../_lib/env";
import {
  LIMITS,
  checkbox,
  email as validateEmail,
  optionalText,
  phone as validatePhone,
  requiredText,
  str,
} from "../_lib/validate";
import { verifyTurnstile } from "../_lib/turnstile";
import { sendNotification } from "../_lib/notify";

/**
 * POST /api/contact
 *
 * Writes a contact submission and its consent record — spec 6.3.
 *
 * The consent columns are the point of this endpoint, not an afterthought.
 * Every row stores the boolean AND the full label text the person was shown,
 * because "they ticked a box" is not a TCPA defence; "here is the exact
 * sentence they read on this date" is.
 *
 * Consent is never required. A submission with the box unchecked is a
 * completely valid submission and must succeed.
 *
 * ONE CHECKBOX, TWO COLUMNS — deliberate, 2026-08-13.
 * The form used to have separate service and marketing checkboxes, and the
 * table still has a column pair for each. The client consolidated to a single
 * combined consent whose wording covers marketing *and* customer care
 * messages, so one tick genuinely grants both. Rather than migrate a table
 * that may already hold live rows, the same value and the same label text are
 * written to both pairs. That keeps historical rows readable, keeps the schema
 * stable, and is an accurate record: the person did agree to both.
 */

const TOPICS = [
  "New quote",
  "Existing policy",
  "Claim",
  "Careers",
  "Something else",
] as const;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Could not read that submission.");
  }

  // --- Validate -----------------------------------------------------------

  const name = requiredText(payload.name, "Name", LIMITS.name);
  if (!name.ok) return badRequest(name.error);

  const email = validateEmail(payload.email);
  if (!email.ok) return badRequest(email.error);

  const phone = validatePhone(payload.phone);
  if (!phone.ok) return badRequest(phone.error);

  const topicValue = str(payload.topic);
  if (!topicValue) return badRequest("Choose what we can help with.");
  if (!TOPICS.includes(topicValue as (typeof TOPICS)[number])) {
    return badRequest("That topic is not valid.");
  }

  const message = requiredText(payload.message, "Message", LIMITS.message);
  if (!message.ok) return badRequest(message.error);

  const pageUrl = optionalText(payload.page_url, "Page URL", LIMITS.pageUrl);
  if (!pageUrl.ok) return badRequest(pageUrl.error);

  // --- Spam check ---------------------------------------------------------

  const clientIp = request.headers.get("CF-Connecting-IP");
  const turnstile = await verifyTurnstile(
    str(payload.turnstile_token) || undefined,
    env,
    clientIp,
  );
  if (!turnstile.ok) return badRequest(turnstile.error ?? "The spam check did not pass.");

  // --- Consent ------------------------------------------------------------
  //
  // The label text is taken from the request so the record reflects exactly
  // what was rendered to this person. It is length-capped and stored as-is.

  // `consent_sms` is the current field name. The old `consent_marketing` /
  // `consent_service` names are still accepted so a visitor holding a cached
  // copy of the previous page does not silently lose their consent during a
  // deploy.
  const consentGiven = checkbox(
    payload.consent_sms ?? payload.consent_marketing ?? payload.consent_service,
  );

  const consentTextRaw =
    payload.consent_sms_text ?? payload.consent_marketing_text ?? payload.consent_service_text;
  const consentText = optionalText(consentTextRaw, "Consent text", 2000);
  if (!consentText.ok) return badRequest(consentText.error);

  // --- Persist ------------------------------------------------------------

  const id = newId();
  const createdAt = nowIso();

  try {
    await env.DB.prepare(
      `INSERT INTO contact_submissions (
         id, created_at, name, email, phone, topic, message,
         consent_service, consent_marketing,
         consent_service_text, consent_marketing_text,
         page_url, user_agent, ip_address, status
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        id,
        createdAt,
        name.value,
        email.value,
        phone.value,
        topicValue,
        message.value,
        // Both columns carry the same combined consent — see the note above.
        consentGiven,
        consentGiven,
        consentText.value,
        consentText.value,
        pageUrl.value,
        (request.headers.get("User-Agent") ?? "").slice(0, LIMITS.userAgent),
        clientIp ?? "",
        "new",
      )
      .run();
  } catch (error) {
    console.error("[contact] insert failed", error);
    return serverError("We could not save that. Please call or text us instead.");
  }

  // --- Notify (best effort, never blocks the response) --------------------

  await sendNotification(env, {
    subject: `New message: ${topicValue} — ${name.value}`,
    heading: "New contact form submission",
    replyTo: email.value,
    rows: [
      ["Name", name.value],
      ["Email", email.value],
      ["Mobile", phone.value],
      ["Topic", topicValue],
      ["Text messages", consentGiven ? "YES — opted in" : "No"],
      ["Submitted", createdAt],
    ],
    body: { label: "Message", value: message.value },
    footerNote:
      "The exact consent wording shown to this person is stored with the record in the admin dashboard.",
  });

  return json({ ok: true, id }, 201);
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "POST") return onRequestPost(context);
  return methodNotAllowed("POST");
};
