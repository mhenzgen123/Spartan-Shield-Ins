import { useEffect, useId, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget — spec 3.5.
 *
 * Free, privacy-preserving, and usually invisible. A honeypot alone is not
 * enough; these forms will be scraped.
 *
 * If PUBLIC_TURNSTILE_SITE_KEY is unset (local development before the keys
 * exist) the widget renders nothing and the form still works. The server side
 * mirrors this: it only enforces verification when TURNSTILE_SECRET_KEY is
 * configured, so a half-configured deployment fails open in dev and closed in
 * production once the secret is set.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

interface Props {
  siteKey?: string;
  onToken: (token: string) => void;
  /** Bump to force the widget to reset after a failed submission. */
  resetKey?: number;
}

export default function Turnstile({ siteKey, onToken, resetKey = 0 }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const fallbackId = useId();

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          theme: "light",
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => {
            onToken("");
            setFailed(true);
          },
        });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
    // onToken is stable in both call sites (useCallback), so this runs once.
  }, [siteKey, onToken]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  }, [resetKey]);

  if (!siteKey) return null;

  return (
    <div>
      <div ref={container} id={fallbackId} />
      {failed && (
        <p className="field-error" role="alert">
          The spam check could not load. Please call or text us instead — the number is at the
          top of this page.
        </p>
      )}
    </div>
  );
}
