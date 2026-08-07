import { useCallback, useRef, useState } from "react";
import Turnstile from "./Turnstile";
import {
  consentCheckboxes,
  consentEyebrow,
  segmentConsent,
  type ConsentCheckbox,
} from "@/data/consent";
import { url } from "@/data/site";

/**
 * Contact form — spec 5.7 and Section 6.
 *
 * COMPLIANCE INVARIANTS. Do not "improve" any of these:
 *
 *   · Both consent checkboxes render UNCHECKED on first load AND after a
 *     failed validation pass. Nothing pre-selects them.
 *   · Neither checkbox carries `required`. The form submits successfully with
 *     both unchecked — consent is not a condition of contacting the agency.
 *   · The label text is imported from src/data/consent.ts and never retyped
 *     here. The same strings go into the TCR campaign submission.
 *   · The full label text of both boxes is posted with every submission and
 *     stored on the row, so a historical record shows exactly what a person
 *     agreed to on that date even if the wording is later revised.
 */

export const TOPICS = [
  "New quote",
  "Existing policy",
  "Claim",
  "Careers",
  "Something else",
] as const;

type Topic = (typeof TOPICS)[number];

interface Values {
  name: string;
  email: string;
  phone: string;
  topic: Topic | "";
  message: string;
  consent_service: boolean;
  consent_marketing: boolean;
}

type FieldName = "name" | "email" | "phone" | "topic" | "message";

const EMPTY: Values = {
  name: "",
  email: "",
  phone: "",
  topic: "",
  message: "",
  // Unchecked. CR4001.
  consent_service: false,
  consent_marketing: false,
};

function validateField(field: FieldName, values: Values): string {
  const value = values[field];

  switch (field) {
    case "name":
      if (!value.toString().trim()) return "Enter your name.";
      return "";
    case "email": {
      const email = value.toString().trim();
      if (!email) return "Enter your email address.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
        return "Enter a valid email address.";
      return "";
    }
    case "phone": {
      const digits = value.toString().replace(/\D/g, "");
      if (!digits) return "Enter your mobile number.";
      if (digits.length < 10) return "Enter a 10-digit mobile number.";
      if (digits.length > 11) return "That number is too long.";
      return "";
    }
    case "topic":
      if (!value) return "Choose what we can help with.";
      return "";
    case "message":
      if (!value.toString().trim()) return "Tell us how we can help.";
      return "";
    default:
      return "";
  }
}

const FIELDS: FieldName[] = ["name", "email", "phone", "topic", "message"];

/** Renders the consent label with real anchors, without retyping the copy. */
function ConsentLabel({ box }: { box: ConsentCheckbox }) {
  return (
    <>
      {segmentConsent(box).map((segment, index) =>
        segment.type === "link" ? (
          <a
            key={index}
            href={url(segment.href)}
            className="prose-link font-medium"
            target="_blank"
            rel="noopener"
          >
            {segment.value}
          </a>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </>
  );
}

export default function ContactForm({ siteKey }: { siteKey?: string }) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const [token, setToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleToken = useCallback((next: string) => setToken(next), []);

  const setValue = (field: keyof Values, value: string | boolean) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      // Clear an existing error as soon as the field becomes valid.
      if (FIELDS.includes(field as FieldName) && errors[field as FieldName]) {
        const message = validateField(field as FieldName, next);
        setErrors((prevErrors) => ({ ...prevErrors, [field]: message }));
      }
      return next;
    });
  };

  const handleBlur = (field: FieldName) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, values) }));
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setServerError("");

    const nextErrors: Partial<Record<FieldName, string>> = {};
    for (const field of FIELDS) {
      const message = validateField(field, values);
      if (message) nextErrors[field] = message;
    }
    setErrors(nextErrors);
    setTouched(Object.fromEntries(FIELDS.map((field) => [field, true])));

    const firstInvalid = FIELDS.find((field) => nextErrors[field]);
    if (firstInvalid) {
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
        ?.focus();
      return;
    }

    setStatus("submitting");

    try {
      const response = await fetch(url("/api/contact"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          page_url: window.location.href,
          turnstile_token: token,
          // The exact wording shown to this person, stored on the row.
          consent_service_text: consentCheckboxes[0].text,
          consent_marketing_text: consentCheckboxes[1].text,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || "Something went wrong. Please try again.");
      }

      window.location.assign(url("/thank-you?type=contact"));
    } catch (error) {
      setStatus("error");
      setServerError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setToken("");
      setTurnstileReset((count) => count + 1);
    }
  };

  const invalid = (field: FieldName) => Boolean(touched[field] && errors[field]);
  const describedBy = (field: FieldName) =>
    invalid(field) ? `${field}-error` : undefined;

  return (
    /*
     * Layout note: the fields are paired into two-up rows and the textarea is
     * kept short on purpose. The acceptance criterion is that the ENTIRE
     * consent block is visible on a 1440x900 viewport without scrolling — a
     * TCR reviewer has to be able to screenshot it in one go. Every row added
     * here pushes the consent block closer to the fold, so check that before
     * making this form taller.
     */
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="name">
            Name <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <input
            className="field-input"
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={values.name}
            onChange={(event) => setValue("name", event.target.value)}
            onBlur={() => handleBlur("name")}
            aria-invalid={invalid("name") || undefined}
            aria-describedby={describedBy("name")}
            required
          />
          {invalid("name") && (
            <span className="field-error" id="name-error">
              {errors.name}
            </span>
          )}
        </div>

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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="phone">
            Mobile phone <span aria-hidden="true">*</span>
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

        <div>
          <label className="field-label" htmlFor="topic">
            What can we help with? <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <select
            className="field-input"
            id="topic"
            name="topic"
            value={values.topic}
            onChange={(event) => setValue("topic", event.target.value)}
            onBlur={() => handleBlur("topic")}
            aria-invalid={invalid("topic") || undefined}
            aria-describedby={describedBy("topic")}
            required
          >
            <option value="">Choose one</option>
            {TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
          {invalid("topic") && (
            <span className="field-error" id="topic-error">
              {errors.topic}
            </span>
          )}
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="message">
          Message <span aria-hidden="true">*</span>
          <span className="sr-only">(required)</span>
        </label>
        <textarea
          className="field-input !min-h-[104px]"
          id="message"
          name="message"
          rows={3}
          maxLength={4000}
          value={values.message}
          onChange={(event) => setValue("message", event.target.value)}
          onBlur={() => handleBlur("message")}
          aria-invalid={invalid("message") || undefined}
          aria-describedby={describedBy("message")}
          required
        />
        {invalid("message") && (
          <span className="field-error" id="message-error">
            {errors.message}
          </span>
        )}
      </div>

      {/* ==================================================================
          CONSENT BLOCK — TCR call to action. Section 6.2.
          Bordered container, eyebrow, two sibling checkboxes, both optional.
          ================================================================== */}
      <fieldset className="rounded-[8px] border border-on-light-mu/30 bg-parchment/60 px-4 pb-4 pt-1">
        <legend className="type-eyebrow px-2 text-oxblood">{consentEyebrow}</legend>

        <div className="space-y-3">
          {consentCheckboxes.map((box) => (
            <div key={box.id} className="flex items-start gap-3">
              <input
                className="control-box"
                type="checkbox"
                id={box.id}
                name={box.name}
                /* Unchecked by default and after any validation error. */
                checked={values[box.name as "consent_service" | "consent_marketing"]}
                onChange={(event) =>
                  setValue(
                    box.name as "consent_service" | "consent_marketing",
                    event.target.checked,
                  )
                }
                /* Deliberately NOT required. CR4001. */
              />
              <label className="type-small !leading-[1.5] text-on-light-mu" htmlFor={box.id}>
                <ConsentLabel box={box} />
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      <Turnstile siteKey={siteKey} onToken={handleToken} resetKey={turnstileReset} />

      {serverError && (
        <p className="field-error" role="alert">
          {serverError}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-full" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send message"}
      </button>

      <p className="type-small text-on-light-mu">
        Prefer to talk? Calling is the fastest way to reach us.
      </p>
    </form>
  );
}
