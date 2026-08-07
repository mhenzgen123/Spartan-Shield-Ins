import { json, methodNotAllowed, serverError, type Env } from "../../../_lib/env";
import { NO_STORE, requireAdmin } from "./../_guard";

/**
 * GET /api/admin/resume/:id
 *
 * Streams a resume out of R2 behind a verified Access JWT — spec 8.3.
 *
 * R2 OBJECTS ARE NEVER PUBLICLY REACHABLE. The bucket has no public URL; the
 * only way to get a file is through this endpoint, which checks the JWT first.
 * The R2 key is looked up from D1 by application id, so a caller cannot supply
 * an arbitrary key and walk the bucket.
 */

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const id = String(params.id ?? "");
  if (!id) return json({ error: "Missing application id." }, 400, NO_STORE);

  let row: { resume_key: string; resume_filename: string } | null;

  try {
    row = await env.DB.prepare(
      `SELECT resume_key, resume_filename FROM applications WHERE id = ?`,
    )
      .bind(id)
      .first<{ resume_key: string; resume_filename: string }>();
  } catch (error) {
    console.error("[admin/resume] lookup failed", error);
    return serverError("Could not look up that resume.");
  }

  if (!row) return json({ error: "No application with that id." }, 404, NO_STORE);

  const object = await env.RESUMES.get(row.resume_key);
  if (!object) {
    console.error(`[admin/resume] object missing from R2: ${row.resume_key}`);
    return json({ error: "That resume file is missing from storage." }, 404, NO_STORE);
  }

  console.log(`[admin] ${admin.email} downloaded resume for application ${id}`);

  const headers = new Headers(NO_STORE);
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType ?? "application/octet-stream",
  );
  // Always an attachment. Never render an uploaded file inline in the browser.
  headers.set(
    "Content-Disposition",
    `attachment; filename="${row.resume_filename.replace(/"/g, "")}"`,
  );
  headers.set("Content-Length", String(object.size));
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(object.body, { headers });
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "GET") return onRequestGet(context);
  return methodNotAllowed("GET");
};
