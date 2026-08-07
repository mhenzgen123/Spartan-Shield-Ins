import { useCallback, useEffect, useRef, useState } from "react";
import Turnstile from "./Turnstile";
import { url } from "@/data/site";

/**
 * Job application form — spec 5.6.
 *
 * NO SMS CONSENT CHECKBOX ON THIS FORM. Applicant consent and customer consent
 * are different campaigns with different rules; mixing them muddies the
 * record. The texting opt-in lives on /contact only.
 *
 * Client-side validation runs on blur for convenience. It is not a security
 * boundary — /api/apply re-validates everything, including the file type and
 * size, because a client check can be bypassed by anyone with a terminal.
 */

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ACCEPTED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export interface RoleOption {
  slug: string;
  title: string;
}

type Licensed = "Yes" | "No" | "In progress";

const LICENSED_OPTIONS: Licensed[] = ["Yes", "No", "In progress"];

interface Values {
  position: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string;
  licensed: Licensed | "";
  notes: string;
}

type FieldName = keyof Values | "resume";

const REQUIRED: FieldName[] = [
  "position",
  "first_name",
  "last_name",
  "email",
  "phone",
  "location",
  "licensed",
  "resume",
];

function validate(field: FieldName, values: Values, file: File | null): string {
  switch (field) {
    case "position":
      return values.position ? "" : "Choose the role you are applying for.";
    case "first_name":
      return values.first_name.trim() ? "" : "Enter your first name.";
    case "last_name":
      return values.last_name.trim() ? "" : "Enter your last name.";
    case "email": {
      const email = values.email.trim();
      if (!email) return "Enter your email address.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Enter a valid email address.";
      return "";
    }
    case "phone": {
      const digits = values.phone.replace(/\D/g, "");
      if (!digits) return "Enter your phone number.";
      if (digits.length < 10) return "Enter a 10-digit phone number.";
      if (digits.length > 11) return "That number is too long.";
      return "";
    }
    case "location":
      return values.location.trim() ? "" : "Enter your city and state.";
    case "linkedin_url": {
      const url = values.linkedin_url.trim();
      if (!url) return "";
      try {
        const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
        return parsed.hostname.includes("linkedin.")
          ? ""
          : "That does not look like a LinkedIn URL.";
      } catch {
        return "Enter a valid URL, or leave this blank.";
      }
    }
    case "licensed":
      return values.licensed ? "" : "Let us know your licensing status.";
    case "notes":
      return values.notes.length > 1000 ? "Keep this under 1000 characters." : "";
    case "resume": {
      if (!file) return "Attach your resume.";
      const name = file.name.toLowerCase();
      const extensionOk = ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
      // Some browsers send an empty or generic MIME type for .doc, so the
      // extension is the primary check and the MIME type is a secondary one.
      if (!extensionOk) return "Upload a PDF, DOC, or DOCX file.";
      if (file.type && !ACCEPTED_MIME.includes(file.type) && file.type !== "application/octet-stream")
        return "Upload a PDF, DOC, or DOCX file.";
      if (file.size > MAX_RESUME_BYTES) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        return `That file is ${mb} MB. The limit is 5 MB.`;
      }
      if (file.size === 0) return "That file appears to be empty.";
      return "";
    }
    default:
      return "";
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  roles: RoleOption[];
  siteKey?: string;
}

export default function ApplicationForm({ roles, siteKey }: Props) {
  const [values, setValues] = useState<Values>({
    position: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    location: "",
    linkedin_url: "",
    licensed: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const [token, setToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleToken = useCallback((next: string) => setToken(next), []);

  // Prefill the position from ?role=<slug>. Read once on mount; the select
  // stays fully editable afterwards.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("role");
    if (slug && roles.some((role) => role.slug === slug)) {
      setValues((prev) => ({ ...prev, position: slug }));
    }
  }, [roles]);

  const setValue = (field: keyof Values, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      if (errors[field]) {
        setErrors((prevErrors) => ({ ...prevErrors, [field]: validate(field, next, file) }));
      }
      return next;
    });
  };

  const handleBlur = (field: FieldName) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validate(field, values, file) }));
  };

  const handleFile = (next: File | null) => {
    setFile(next);
    setTouched((prev) => ({ ...prev, resume: true }));
    setErrors((prev) => ({ ...prev, resume: validate("resume", values, next) }));
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setServerError("");

    const allFields: FieldName[] = [...REQUIRED, "linkedin_url", "notes"];
    const nextErrors: Partial<Record<FieldName, string>> = {};
    for (const field of allFields) {
      const message = validate(field, values, file);
      if (message) nextErrors[field] = message;
    }
    setErrors(nextErrors);
    setTouched(Object.fromEntries(allFields.map((field) => [field, true])));

    const firstInvalid = allFields.find((field) => nextErrors[field]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    setStatus("submitting");

    try {
      const body = new FormData();
      for (const [key, value] of Object.entries(values)) body.append(key, value);
      if (file) body.append("resume", file, file.name);
      if (token) body.append("turnstile_token", token);

      const response = await fetch(url("/api/apply"), { method: "POST", body });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Something went wrong. Please try again.");
      }

      window.location.assign(url("/thank-you?type=application"));
    } catch (error) {
      setStatus("error");
      setServerError(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
      setToken("");
      setTurnstileReset((count) => count + 1);
    }
  };

  const invalid = (field: FieldName) => Boolean(touched[field] && errors[field]);
  const describedBy = (field: FieldName, extra?: string) => {
    const ids = [invalid(field) ? `${field}-error` : null, extra].filter(Boolean);
    return ids.length ? ids.join(" ") : undefined;
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label className="field-label" htmlFor="position">
          Position <span aria-hidden="true">*</span>
          <span className="sr-only">(required)</span>
        </label>
        <select
          className="field-input"
          id="position"
          name="position"
          value={values.position}
          onChange={(event) => setValue("position", event.target.value)}
          onBlur={() => handleBlur("position")}
          aria-invalid={invalid("position") || undefined}
          aria-describedby={describedBy("position")}
          required
        >
          <option value="">Choose a role</option>
          {roles.map((role) => (
            <option key={role.slug} value={role.slug}>
              {role.title}
            </option>
          ))}
        </select>
        {invalid("position") && (
          <span className="field-error" id="position-error">
            {errors.position}
          </span>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="first_name">
            First name <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <input
            className="field-input"
            id="first_name"
            name="first_name"
            type="text"
            autoComplete="given-name"
            value={values.first_name}
            onChange={(event) => setValue("first_name", event.target.value)}
            onBlur={() => handleBlur("first_name")}
            aria-invalid={invalid("first_name") || undefined}
            aria-describedby={describedBy("first_name")}
            required
          />
          {invalid("first_name") && (
            <span className="field-error" id="first_name-error">
              {errors.first_name}
            </span>
          )}
        </div>

        <div>
          <label className="field-label" htmlFor="last_name">
            Last name <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <input
            className="field-input"
            id="last_name"
            name="last_name"
            type="text"
            autoComplete="family-name"
            value={values.last_name}
            onChange={(event) => setValue("last_name", event.target.value)}
            onBlur={() => handleBlur("last_name")}
            aria-invalid={invalid("last_name") || undefined}
            aria-describedby={describedBy("last_name")}
            required
          />
          {invalid("last_name") && (
            <span className="field-error" id="last_name-error">
              {errors.last_name}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="email">
            Email <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <input
            className="field-input"
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => setValue("email", event.target.value)}
            onBlur={() => handleBlur("email")}
            aria-invalid={invalid("email") || undefined}
            aria-describedby={describedBy("email")}
            required
          />
          {invalid("email") && (
            <span className="field-error" id="email-error">
              {errors.email}
            </span>
          )}
        </div>

        <div>
          <label className="field-label" htmlFor="phone">
            Phone <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <input
            className="field-input"
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(event) => setValue("phone", event.target.value)}
            onBlur={() => handleBlur("phone")}
            aria-invalid={invalid("phone") || undefined}
            aria-describedby={describedBy("phone")}
            required
          />
          {invalid("phone") && (
            <span className="field-error" id="phone-error">
              {errors.phone}
            </span>
          )}
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="location">
          City and state <span aria-hidden="true">*</span>
          <span className="sr-only">(required)</span>
        </label>
        <input
          className="field-input"
          id="location"
          name="location"
          type="text"
          autoComplete="address-level2"
          placeholder="Louisville, KY"
          value={values.location}
          onChange={(event) => setValue("location", event.target.value)}
          onBlur={() => handleBlur("location")}
          aria-invalid={invalid("location") || undefined}
          aria-describedby={describedBy("location")}
          required
        />
        {invalid("location") && (
          <span className="field-error" id="location-error">
            {errors.location}
          </span>
        )}
      </div>

      <div>
        <label className="field-label" htmlFor="linkedin_url">
          LinkedIn URL <span className="font-normal text-on-light-mu">(optional)</span>
        </label>
        <input
          className="field-input"
          id="linkedin_url"
          name="linkedin_url"
          type="url"
          inputMode="url"
          placeholder="https://www.linkedin.com/in/…"
          value={values.linkedin_url}
          onChange={(event) => setValue("linkedin_url", event.target.value)}
          onBlur={() => handleBlur("linkedin_url")}
          aria-invalid={invalid("linkedin_url") || undefined}
          aria-describedby={describedBy("linkedin_url")}
        />
        {invalid("linkedin_url") && (
          <span className="field-error" id="linkedin_url-error">
            {errors.linkedin_url}
          </span>
        )}
      </div>

      <fieldset>
        <legend className="field-label">
          Currently P&amp;C licensed? <span aria-hidden="true">*</span>
          <span className="sr-only">(required)</span>
        </legend>
        <div
          className="mt-1 flex flex-wrap gap-x-6 gap-y-2"
          role="radiogroup"
          aria-describedby={describedBy("licensed")}
          aria-required="true"
        >
          {LICENSED_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-[0.9375rem] text-on-light">
              <input
                className="control-box !mt-0"
                type="radio"
                name="licensed"
                value={option}
                checked={values.licensed === option}
                onChange={(event) => setValue("licensed", event.target.value)}
                onBlur={() => handleBlur("licensed")}
                required
              />
              {option}
            </label>
          ))}
        </div>
        {invalid("licensed") && (
          <span className="field-error" id="licensed-error">
            {errors.licensed}
          </span>
        )}
      </fieldset>

      <div>
        <label className="field-label" htmlFor="resume">
          Resume <span aria-hidden="true">*</span>
          <span className="sr-only">(required)</span>
        </label>
        <input
          className="field-input h-auto py-2.5 file:mr-3 file:cursor-pointer file:rounded-[4px] file:border-0 file:bg-cream file:px-3 file:py-2 file:text-[0.875rem] file:font-semibold file:text-oxblood"
          id="resume"
          name="resume"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          aria-invalid={invalid("resume") || undefined}
          aria-describedby={describedBy("resume", "resume-hint")}
          required
        />
        <span className="field-hint" id="resume-hint">
          PDF, DOC, or DOCX. Up to 5 MB.
          {file && !errors.resume ? ` Attached: ${file.name} (${formatBytes(file.size)}).` : ""}
        </span>
        {invalid("resume") && (
          <span className="field-error" id="resume-error">
            {errors.resume}
          </span>
        )}
      </div>

      <div>
        <label className="field-label" htmlFor="notes">
          Anything else we should know?{" "}
          <span className="font-normal text-on-light-mu">(optional)</span>
        </label>
        <textarea
          className="field-input"
          id="notes"
          name="notes"
          rows={4}
          maxLength={1000}
          value={values.notes}
          onChange={(event) => setValue("notes", event.target.value)}
          onBlur={() => handleBlur("notes")}
          aria-invalid={invalid("notes") || undefined}
          aria-describedby={describedBy("notes", "notes-hint")}
        />
        <span className="field-hint" id="notes-hint">
          {1000 - values.notes.length} characters remaining.
        </span>
      </div>

      <Turnstile siteKey={siteKey} onToken={handleToken} resetKey={turnstileReset} />

      {serverError && (
        <p className="field-error" role="alert">
          {serverError}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-full" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Submit application"}
      </button>
    </form>
  );
}
