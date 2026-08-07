import { verifyAccess } from "../../_lib/access";
import { json, type Env } from "../../_lib/env";

/**
 * Every admin endpoint calls this first.
 *
 * Cloudflare Access already fronts these routes, but presence of the
 * Cf-Access-Jwt-Assertion header proves nothing on its own — a header is just
 * a string. The JWT signature, audience, issuer, and expiry are all verified
 * against the team's published keys before a single row of PII is returned.
 */
export async function requireAdmin(
  request: Request,
  env: Env,
): Promise<{ email: string } | Response> {
  const result = await verifyAccess(request, env);

  if (!result.ok) {
    return json({ error: result.error }, result.status, {
      "Cache-Control": "no-store",
    });
  }

  return { email: result.identity.email };
}

/** Shared no-cache headers. Admin responses must never sit in a CDN. */
export const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;
