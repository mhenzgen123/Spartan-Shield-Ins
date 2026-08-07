import { json, methodNotAllowed, serverError, type Env } from "../../_lib/env";
import { NO_STORE, requireAdmin } from "./_guard";

/**
 * GET /api/admin/export?tab=applications|messages
 *
 * CSV export for both tabs. Costs almost nothing and saves the owners from
 * ever having to ask for it — spec 8.2.
 */

const APPLICATION_COLUMNS = [
  "created_at",
  "position",
  "first_name",
  "last_name",
  "email",
  "phone",
  "location",
  "linkedin_url",
  "licensed",
  "status",
  "resume_filename",
  "resume_size",
  "notes",
  "id",
] as const;

const MESSAGE_COLUMNS = [
  "created_at",
  "name",
  "email",
  "phone",
  "topic",
  "status",
  "consent_service",
  "consent_marketing",
  "message",
  "consent_service_text",
  "consent_marketing_text",
  "page_url",
  "ip_address",
  "user_agent",
  "id",
] as const;

/**
 * RFC 4180 quoting, plus a leading apostrophe on anything a spreadsheet would
 * try to evaluate. Without that, a message body starting with "=" becomes a
 * formula the moment the owners open the file in Excel.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(columns: readonly string[], rows: Record<string, unknown>[]): string {
  const header = columns.map(csvCell).join(",");
  const body = rows.map((row) => columns.map((column) => csvCell(row[column])).join(","));
  // BOM so Excel opens UTF-8 correctly.
  return `﻿${[header, ...body].join("\r\n")}\r\n`;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const admin = await requireAdmin(request, env);
  if (admin instanceof Response) return admin;

  const tab = new URL(request.url).searchParams.get("tab") ?? "applications";

  if (tab !== "applications" && tab !== "messages") {
    return json({ error: "Unknown export." }, 400, NO_STORE);
  }

  const table = tab === "applications" ? "applications" : "contact_submissions";
  const columns = tab === "applications" ? APPLICATION_COLUMNS : MESSAGE_COLUMNS;

  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 5000`,
    ).all<Record<string, unknown>>();

    const csv = toCsv(columns, results ?? []);
    const stamp = new Date().toISOString().slice(0, 10);

    console.log(`[admin] ${admin.email} exported ${tab}`);

    return new Response(csv, {
      headers: {
        ...NO_STORE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="spartan-shield-${tab}-${stamp}.csv"`,
      },
    });
  } catch (error) {
    console.error("[admin/export] failed", error);
    return serverError("Could not build that export.");
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "GET") return onRequestGet(context);
  return methodNotAllowed("GET");
};
