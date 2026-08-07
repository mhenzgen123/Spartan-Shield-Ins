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
  email as validateEmail,
  fileExtension,
  linkedIn,
  oneOf,
  optionalText,
  phone as validatePhone,
  requiredText,
  sanitizeFilename,
  str,
  validateResume,
} from "../_lib/validate";
import { verifyTurnstile } from "../_lib/turnstile";
import { sendNotification } from "../_lib/notify";

/**
 * POST /api/apply
 *
 * Accepts a multipart job application with a resume file, stores the file in
 * R2 and the metadata in D1.
 *
 * The file checks here are the real ones. The browser also checks type and
 * size, but that is a convenience for honest users — an oversized or
 * wrong-type upload has to fail HERE, and it does.
 */

const LICENSED = ["Yes", "No", "In progress"] as const;

/** Keep in step with src/data/roles.json. */
const POSITIONS = ["sales-executive", "client-relations-specialist"] as const;

const POSITION_TITLES: Record<string, string> = {
  "sales-executive": "Sales Executive",
  "client-relations-specialist": "Client Relations Specialist",
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return badRequest("Could not read that submission.");
  }

  // --- Validate the text fields -------------------------------------------

  const position = oneOf(form.get("position"), POSITIONS, "Position");
  if (!position.ok) return badRequest(position.error);

  const firstName = requiredText(form.get("first_name"), "First name", LIMITS.name);
  if (!firstName.ok) return badRequest(firstName.error);

  const lastName = requiredText(form.get("last_name"), "Last name", LIMITS.name);
  if (!lastName.ok) return badRequest(lastName.error);

  const email = validateEmail(form.get("email"));
  if (!email.ok) return badRequest(email.error);

  const phone = validatePhone(form.get("phone"));
  if (!phone.ok) return badRequest(phone.error);

  const location = requiredText(form.get("location"), "City and state", LIMITS.location);
  if (!location.ok) return badRequest(location.error);

  const linkedinUrl = linkedIn(form.get("linkedin_url"));
  if (!linkedinUrl.ok) return badRequest(linkedinUrl.error);

  const licensed = oneOf(form.get("licensed"), LICENSED, "Licensing status");
  if (!licensed.ok) return badRequest(licensed.error);

  const notes = optionalText(form.get("notes"), "Notes", LIMITS.notes);
  if (!notes.ok) return badRequest(notes.error);

  // --- Validate the resume ------------------------------------------------

  const uploaded = form.get("resume");
  const resume = validateResume(uploaded instanceof File ? uploaded : null);
  if (!resume.ok) return badRequest(resume.error);

  // --- Spam check ---------------------------------------------------------

  const clientIp = request.headers.get("CF-Connecting-IP");
  const turnstile = await verifyTurnstile(
    str(form.get("turnstile_token")) || undefined,
    env,
    clientIp,
  );
  if (!turnstile.ok) return badRequest(turnstile.error ?? "The spam check did not pass.");

  // --- Store the file -----------------------------------------------------
  //
  // Key pattern: resumes/{yyyy}/{mm}/{id}-{sanitized}. The client-supplied
  // filename is never trusted; it is sanitised to [a-zA-Z0-9._-] and capped.

  const id = newId();
  const createdAt = nowIso();
  const now = new Date(createdAt);
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  const safeName = sanitizeFilename(resume.value.name);
  const key = `resumes/${year}/${month}/${id}-${safeName}`;

  const extension = fileExtension(safeName);
  const contentType =
    extension === "pdf"
      ? "application/pdf"
      : extension === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/msword";

  try {
    await env.RESUMES.put(key, resume.value.stream(), {
      httpMetadata: {
        contentType,
        contentDisposition: `attachment; filename="${safeName}"`,
      },
      customMetadata: {
        application_id: id,
        original_filename: safeName,
        position: position.value,
      },
    });
  } catch (error) {
    console.error("[apply] R2 put failed", error);
    return serverError("We could not upload that file. Please try again.");
  }

  // --- Persist the metadata -----------------------------------------------

  try {
    await env.DB.prepare(
      `INSERT INTO applications (
         id, created_at, position, first_name, last_name, email, phone,
         location, linkedin_url, licensed, notes,
         resume_key, resume_filename, resume_size, status
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        id,
        createdAt,
        position.value,
        firstName.value,
        lastName.value,
        email.value,
        phone.value,
        location.value,
        linkedinUrl.value || null,
        licensed.value,
        notes.value || null,
        key,
        safeName,
        resume.value.size,
        "new",
      )
      .run();
  } catch (error) {
    console.error("[apply] insert failed", error);
    // The file is already in R2. Remove it so we do not accumulate orphans.
    await env.RESUMES.delete(key).catch(() => undefined);
    return serverError("We could not save that application. Please try again.");
  }

  // --- Notify -------------------------------------------------------------

  await sendNotification(env, {
    subject: `New application: ${POSITION_TITLES[position.value] ?? position.value} — ${firstName.value} ${lastName.value}`,
    heading: "New job application",
    replyTo: email.value,
    rows: [
      ["Position", POSITION_TITLES[position.value] ?? position.value],
      ["Name", `${firstName.value} ${lastName.value}`],
      ["Email", email.value],
      ["Phone", phone.value],
      ["Location", location.value],
      ["LinkedIn", linkedinUrl.value],
      ["P&C licensed", licensed.value],
      ["Resume", `${safeName} (${Math.round(resume.value.size / 1024)} KB)`],
      ["Submitted", createdAt],
    ],
    ...(notes.value ? { body: { label: "Notes", value: notes.value } } : {}),
    footerNote:
      "Download the resume from the applicant dashboard at /careers/admin. Resume files are not attached to this email and are not publicly reachable.",
  });

  return json({ ok: true, id }, 201);
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "POST") return onRequestPost(context);
  return methodNotAllowed("POST");
};
