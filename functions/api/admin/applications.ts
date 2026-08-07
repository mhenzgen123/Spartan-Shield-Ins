import { json, methodNotAllowed, serverError, type Env } from "../../_lib/env";
import { oneOf, str } from "../../_lib/validate";
import { NO_STORE, requireAdmin } from "./_guard";

/**
 * GET  /api/admin/applications          list, newest first
 * PATCH /api/admin/applications         update one row's status
 */

const STATUSES = ["new", "reviewing", "contacted", "passed"] as const;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const url = new URL(request.url);
  const position = url.searchParams.get("position");

  try {
    const query = position
      ? env.DB.prepare(
          `SELECT * FROM applications WHERE position = ? ORDER BY created_at DESC LIMIT 500`,
        ).bind(position)
      : env.DB.prepare(`SELECT * FROM applications ORDER BY created_at DESC LIMIT 500`);

    const { results } = await query.all();
    return json({ ok: true, rows: results ?? [] }, 200, NO_STORE);
  } catch (error) {
    console.error("[admin/applications] query failed", error);
    return serverError("Could not load applications.");
  }
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Could not read that request." }, 400, NO_STORE);
  }

  const id = str(payload.id);
  if (!id) return json({ error: "Missing id." }, 400, NO_STORE);

  const status = oneOf(str(payload.status).toLowerCase(), STATUSES, "Status");
  if (!status.ok) return json({ error: status.error }, 400, NO_STORE);

  try {
    const result = await env.DB.prepare(`UPDATE applications SET status = ? WHERE id = ?`)
      .bind(status.value, id)
      .run();

    if (!result.meta.changes) {
      return json({ error: "No application with that id." }, 404, NO_STORE);
    }

    console.log(`[admin] ${admin.email} set application ${id} to ${status.value}`);
    return json({ ok: true }, 200, NO_STORE);
  } catch (error) {
    console.error("[admin/applications] update failed", error);
    return serverError("Could not update that application.");
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  switch (context.request.method) {
    case "GET":
      return onRequestGet(context);
    case "PATCH":
      return onRequestPatch(context);
    default:
      return methodNotAllowed("GET, PATCH");
  }
};
