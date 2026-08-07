import type { Env } from "./env";

/**
 * Cloudflare Access JWT verification — spec 8.4.
 *
 * Access sits in front of /careers/admin* and will not let an unauthenticated
 * request reach the page at all. But the admin API endpoints are separate
 * routes, and "the header is present" is not authentication: a header can be
 * forged by anyone who can reach the origin. So every admin API call verifies
 * the JWT signature against the team's public keys, then checks the audience,
 * issuer, and expiry.
 *
 * Configure in the Cloudflare dashboard:
 *   Zero Trust → Access → Applications → Add an application
 *     Domain:   spartanshieldins.com/careers/admin*
 *     Policy:   Allow · Emails · sam@… and nick@…
 *     Identity: One-time PIN
 *   Then also protect the API:  spartanshieldins.com/api/admin*
 *
 * Copy the Application Audience (AUD) tag into CF_ACCESS_AUD and the team
 * domain into CF_ACCESS_TEAM_DOMAIN.
 */

const JWT_HEADER = "Cf-Access-Jwt-Assertion";
const COOKIE_NAME = "CF_Authorization";

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n: string;
  e: string;
}

interface CertsResponse {
  keys: Jwk[];
}

interface AccessPayload {
  aud: string[] | string;
  email?: string;
  exp: number;
  iat?: number;
  nbf?: number;
  iss: string;
  sub?: string;
}

export interface AccessIdentity {
  email: string;
  sub?: string;
}

export type AccessResult =
  | { ok: true; identity: AccessIdentity }
  | { ok: false; status: 401 | 403 | 500; error: string };

// Public keys rotate roughly every six weeks. Cache per isolate for an hour.
let certsCache: { keys: Jwk[]; fetchedAt: number; team: string } | null = null;
const CERTS_TTL_MS = 60 * 60 * 1000;

function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeJson<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as T;
}

async function getCerts(teamDomain: string): Promise<Jwk[]> {
  const fresh =
    certsCache &&
    certsCache.team === teamDomain &&
    Date.now() - certsCache.fetchedAt < CERTS_TTL_MS;

  if (fresh && certsCache) return certsCache.keys;

  // Bounded: without a timeout, a stalled certs fetch hangs every admin
  // request until the platform kills the worker.
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Access certs fetch failed: ${response.status}`);

  const body = (await response.json()) as CertsResponse;
  certsCache = { keys: body.keys, fetchedAt: Date.now(), team: teamDomain };
  return body.keys;
}

function readToken(request: Request): string | null {
  const header = request.headers.get(JWT_HEADER);
  if (header) return header;

  // Direct browser navigations carry the cookie instead of the header.
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Verify the Access JWT on a request. Returns the authenticated identity or a
 * status to respond with.
 */
export async function verifyAccess(request: Request, env: Env): Promise<AccessResult> {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN;
  const aud = env.CF_ACCESS_AUD;

  if (!teamDomain || !aud) {
    // Refuse rather than fall open. An admin endpoint that serves applicant
    // PII must never be reachable because a variable was forgotten.
    console.error("[access] CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD is not configured.");
    return {
      ok: false,
      status: 500,
      error: "Admin access is not configured. See DEPLOYMENT.md.",
    };
  }

  const token = readToken(request);
  if (!token) return { ok: false, status: 401, error: "Not authenticated." };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, status: 401, error: "Malformed token." };

  const [headerSegment, payloadSegment, signatureSegment] = parts;

  let header: { kid?: string; alg?: string };
  let payload: AccessPayload;
  try {
    header = decodeJson(headerSegment);
    payload = decodeJson(payloadSegment);
  } catch {
    return { ok: false, status: 401, error: "Malformed token." };
  }

  if (header.alg !== "RS256") {
    return { ok: false, status: 401, error: "Unsupported token algorithm." };
  }

  let keys: Jwk[];
  try {
    keys = await getCerts(teamDomain);
  } catch (error) {
    console.error("[access] could not fetch signing keys", error);
    return { ok: false, status: 500, error: "Could not verify your session." };
  }

  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) return { ok: false, status: 401, error: "Unknown signing key." };

  let verified = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );

    verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlToBytes(signatureSegment) as BufferSource,
      new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
    );
  } catch (error) {
    console.error("[access] signature verification threw", error);
    return { ok: false, status: 401, error: "Could not verify your session." };
  }

  if (!verified) return { ok: false, status: 401, error: "Invalid token signature." };

  const now = Math.floor(Date.now() / 1000);
  const skew = 60;

  if (typeof payload.exp !== "number" || payload.exp + skew < now) {
    return { ok: false, status: 401, error: "Your session has expired. Reload to sign in again." };
  }
  if (typeof payload.nbf === "number" && payload.nbf - skew > now) {
    return { ok: false, status: 401, error: "Token is not yet valid." };
  }
  if (payload.iss !== `https://${teamDomain}`) {
    return { ok: false, status: 401, error: "Unexpected token issuer." };
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(aud)) {
    return { ok: false, status: 403, error: "This token is for a different application." };
  }

  if (!payload.email) {
    return { ok: false, status: 403, error: "No identity on the token." };
  }

  return { ok: true, identity: { email: payload.email, sub: payload.sub } };
}
