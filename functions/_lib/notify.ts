import type { Env } from "./env";
import { escapeHtml } from "./validate";
import { isEnabled } from "./env";

/**
 * Email notification via Resend — spec 3.3.
 *
 * Behind a single flag (ENABLE_EMAIL_NOTIFY) so it can be switched off without
 * a code change. If it is off, submissions still land in D1 and the owners
 * have to check the admin page.
 *
 * FLAG TO THE CLIENT: with notifications off, leads sit unseen. That is the
 * whole risk of turning this off, and it is a real one for an agency whose
 * strategy is fast response.
 *
 * A notification failure must never fail the submission. The row is already
 * written by the time this runs; the worst case is that the owners find the
 * lead in the dashboard instead of their inbox.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

interface SendArgs {
  subject: string;
  heading: string;
  rows: Array<[label: string, value: string]>;
  /** Longer free-text block rendered after the table. */
  body?: { label: string; value: string };
  /** Optional link back into the admin dashboard. */
  footerNote?: string;
  replyTo?: string;
}

export async function sendNotification(env: Env, args: SendArgs): Promise<void> {
  if (!isEnabled(env.ENABLE_EMAIL_NOTIFY)) return;

  const apiKey = env.RESEND_API_KEY;
  const from = env.NOTIFY_FROM;
  const to = (env.NOTIFY_EMAILS ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

  if (!apiKey || !from || to.length === 0) {
    console.warn(
      "[notify] ENABLE_EMAIL_NOTIFY is true but RESEND_API_KEY, NOTIFY_FROM, or NOTIFY_EMAILS is missing.",
    );
    return;
  }

  const tableRows = args.rows
    .map(
      ([label, value]) =>
        `<tr>
           <td style="padding:8px 16px 8px 0;color:#5C554C;font-size:13px;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
           <td style="padding:8px 0;color:#16130F;font-size:15px;vertical-align:top">${escapeHtml(value) || "—"}</td>
         </tr>`,
    )
    .join("");

  const bodyBlock = args.body
    ? `<p style="margin:24px 0 6px;color:#5C554C;font-size:13px">${escapeHtml(args.body.label)}</p>
       <div style="white-space:pre-wrap;background:#F5F2EC;border-left:3px solid #4C1000;border-radius:0 6px 6px 0;padding:14px 18px;color:#16130F;font-size:15px;line-height:1.6">${escapeHtml(
         args.body.value,
       )}</div>`
    : "";

  const footer = args.footerNote
    ? `<p style="margin:28px 0 0;color:#5C554C;font-size:12px;line-height:1.5">${escapeHtml(args.footerNote)}</p>`
    : "";

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#F5F2EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #EAE3D8;border-radius:8px;padding:28px">
    <p style="margin:0 0 4px;color:#4C1000;font-size:11px;letter-spacing:0.18em;text-transform:uppercase">Spartan Shield Insurance</p>
    <h1 style="margin:0 0 20px;color:#16130F;font-size:21px;font-weight:600">${escapeHtml(args.heading)}</h1>
    <table style="width:100%;border-collapse:collapse">${tableRows}</table>
    ${bodyBlock}
    ${footer}
  </div>
</body></html>`;

  const text = [
    args.heading,
    "",
    ...args.rows.map(([label, value]) => `${label}: ${value || "—"}`),
    ...(args.body ? ["", `${args.body.label}:`, args.body.value] : []),
    ...(args.footerNote ? ["", args.footerNote] : []),
  ].join("\n");

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: args.subject,
        html,
        text,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      console.error("[notify] Resend rejected the send", response.status, await response.text());
    }
  } catch (error) {
    // Never surface this to the visitor — their submission already succeeded.
    console.error("[notify] Resend request threw", error);
  }
}
