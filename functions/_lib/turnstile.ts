import type { Env } from "./env";

/**
 * Cloudflare Turnstile server-side verification — spec 3.5.
 *
 * Fails OPEN when TURNSTILE_SECRET_KEY is unset, so local development and the
 * first preview deploy work before the keys exist. Once the secret is set in
 * the Cloudflare dashboard, a missing or invalid token is rejected.
 *
 * Set the secret before launch. Until then the forms are unprotected.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  ok: boolean;
  error?: string;
}

export async function verifyTurnstile(
  token: string | undefined,
  env: Env,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.warn("[turnstile] TURNSTILE_SECRET_KEY is not set — skipping verification.");
    return { ok: true };
  }

  if (!token) {
    return { ok: false, error: "Please complete the spam check and try again." };
  }

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteIp) body.append("remoteip", remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      // A stalled verification must not hold a visitor's submission open.
      signal: AbortSignal.timeout(6000),
    });
    const outcome = (await response.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (!outcome.success) {
      console.warn("[turnstile] verification failed", outcome["error-codes"]);
      return { ok: false, error: "The spam check did not pass. Please try again." };
    }

    return { ok: true };
  } catch (error) {
    console.error("[turnstile] verification request threw", error);
    // A Turnstile outage should not silently swallow a real lead.
    return { ok: true };
  }
}
