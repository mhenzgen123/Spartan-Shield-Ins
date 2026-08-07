/**
 * Shared types and small helpers for the Pages Functions.
 *
 * No secret is ever committed. Everything below is read from the Cloudflare
 * dashboard's environment variables and secrets. See .env.example for the
 * complete list and DEPLOYMENT.md for where to set each one.
 */

export interface Env {
  /** D1 database binding. */
  DB: D1Database;
  /** R2 bucket for resume files. */
  RESUMES: R2Bucket;

  /** Resend API key. Secret. */
  RESEND_API_KEY?: string;
  /** Comma-separated list of notification recipients. */
  NOTIFY_EMAILS?: string;
  /** Verified sending address on the send. subdomain. */
  NOTIFY_FROM?: string;
  /** "true" to send email notifications at all. */
  ENABLE_EMAIL_NOTIFY?: string;

  /** Turnstile secret. Secret. When unset, verification is skipped. */
  TURNSTILE_SECRET_KEY?: string;

  /** e.g. spartanshield.cloudflareaccess.com */
  CF_ACCESS_TEAM_DOMAIN?: string;
  /** Application Audience tag from the Access application. */
  CF_ACCESS_AUD?: string;
}

export type Handler = PagesFunction<Env>;

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function badRequest(error: string): Response {
  return json({ error }, 400);
}

export function serverError(error = "Something went wrong. Please try again."): Response {
  return json({ error }, 500);
}

export function methodNotAllowed(allow: string): Response {
  return json({ error: "Method not allowed." }, 405, { Allow: allow });
}

export function isEnabled(value: string | undefined): boolean {
  return String(value).toLowerCase() === "true";
}

/** RFC 4122 v4, available in the Workers runtime. */
export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
