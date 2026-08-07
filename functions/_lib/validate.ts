/**
 * Server-side validation and sanitisation.
 *
 * The forms validate on the client for convenience. THAT IS NOT A SECURITY
 * BOUNDARY — everything is re-checked here, because anyone with a terminal can
 * post whatever they like to these endpoints.
 */

export const LIMITS = {
  name: 120,
  email: 254,
  phone: 40,
  topic: 60,
  message: 4000,
  location: 120,
  linkedin: 300,
  notes: 1000,
  pageUrl: 500,
  userAgent: 500,
  filename: 100,
} as const;

/** Max resume size in bytes. Mirrors the client-side limit. */
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export const ALLOWED_RESUME_EXTENSIONS = ["pdf", "doc", "docx"] as const;

export const ALLOWED_RESUME_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Some clients send this for .doc; the extension check still has to pass.
  "application/octet-stream",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function str(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

export function requiredText(input: unknown, label: string, max: number): Result<string> {
  const value = str(input);
  if (!value) return { ok: false, error: `${label} is required.` };
  if (value.length > max) return { ok: false, error: `${label} is too long.` };
  return { ok: true, value };
}

export function optionalText(input: unknown, label: string, max: number): Result<string> {
  const value = str(input);
  if (value.length > max) return { ok: false, error: `${label} is too long.` };
  return { ok: true, value };
}

export function email(input: unknown): Result<string> {
  const value = str(input).toLowerCase();
  if (!value) return { ok: false, error: "Email is required." };
  if (value.length > LIMITS.email) return { ok: false, error: "Email is too long." };
  if (!EMAIL_RE.test(value)) return { ok: false, error: "Enter a valid email address." };
  return { ok: true, value };
}

export function phone(input: unknown): Result<string> {
  const raw = str(input);
  if (!raw) return { ok: false, error: "Phone number is required." };
  if (raw.length > LIMITS.phone) return { ok: false, error: "Phone number is too long." };
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return { ok: false, error: "Enter a 10-digit phone number." };
  if (digits.length > 11) return { ok: false, error: "That phone number is too long." };
  return { ok: true, value: raw };
}

export function oneOf<T extends string>(
  input: unknown,
  allowed: readonly T[],
  label: string,
): Result<T> {
  const value = str(input) as T;
  if (!value) return { ok: false, error: `${label} is required.` };
  if (!allowed.includes(value)) return { ok: false, error: `${label} is not valid.` };
  return { ok: true, value };
}

export function linkedIn(input: unknown): Result<string> {
  const value = str(input);
  if (!value) return { ok: true, value: "" };
  if (value.length > LIMITS.linkedin) return { ok: false, error: "That URL is too long." };
  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "Enter a valid LinkedIn URL." };
    }
    return { ok: true, value: parsed.href };
  } catch {
    return { ok: false, error: "Enter a valid LinkedIn URL, or leave it blank." };
  }
}

/** A checkbox arrives as true, "true", "on", or "1" depending on the encoding. */
export function checkbox(input: unknown): 0 | 1 {
  if (input === true) return 1;
  const value = str(input).toLowerCase();
  return value === "true" || value === "on" || value === "1" ? 1 : 0;
}

/**
 * Never trust a client-supplied filename. Strip everything outside
 * [a-zA-Z0-9._-], collapse runs, drop leading dots so nothing can look like a
 * dotfile, and cap the length. Spec Section 7.
 */
export function sanitizeFilename(input: string): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, LIMITS.filename);

  return cleaned || "resume";
}

export function fileExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index + 1).toLowerCase();
}

export function validateResume(file: File | null): Result<File> {
  if (!file || typeof file === "string") {
    return { ok: false, error: "Attach your resume." };
  }
  if (file.size === 0) {
    return { ok: false, error: "That file appears to be empty." };
  }
  if (file.size > MAX_RESUME_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return { ok: false, error: `That file is ${mb} MB. The limit is 5 MB.` };
  }

  const extension = fileExtension(file.name);
  if (!ALLOWED_RESUME_EXTENSIONS.includes(extension as (typeof ALLOWED_RESUME_EXTENSIONS)[number])) {
    return { ok: false, error: "Upload a PDF, DOC, or DOCX file." };
  }

  if (
    file.type &&
    !ALLOWED_RESUME_MIME.includes(file.type as (typeof ALLOWED_RESUME_MIME)[number])
  ) {
    return { ok: false, error: "Upload a PDF, DOC, or DOCX file." };
  }

  return { ok: true, value: file };
}

/** Escape a value for inclusion in an HTML email body. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
