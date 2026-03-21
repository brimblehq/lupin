import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@brimble/ui";

const COOKIE_CONSENT_KEY = "brimble-cookie-consent";
const COOKIE_CONSENT_ENDPOINT = "https://api.brimble.io/auth/user/cookie-consent";

type CookieConsentChoice = "accepted" | "declined";

function readCookieConsent(): CookieConsentChoice | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  return value === "accepted" || value === "declined" ? value : null;
}

function saveCookieConsent(choice: CookieConsentChoice) {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
}

function resolveLocationFromLocale(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const locale = navigator.languages?.[0] ?? navigator.language;
  const localeParts = locale.split("-");
  const regionCode = localeParts.at(-1)?.toUpperCase();

  if (!regionCode || !/^[A-Z]{2}$/.test(regionCode)) {
    return undefined;
  }

  try {
    if (typeof Intl.DisplayNames === "function") {
      const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
      return regionNames.of(regionCode) ?? regionCode;
    }
  } catch {
    return regionCode;
  }

  return regionCode;
}

async function syncCookieConsent(choice: CookieConsentChoice) {
  const payload: { choice: boolean; location?: string } = {
    choice: choice === "accepted",
  };

  const location = resolveLocationFromLocale();
  if (location) {
    payload.location = location;
  }

  try {
    await fetch(COOKIE_CONSENT_ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Best effort sync; local persistence still controls banner visibility.
  }
}

export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hasAuthToken = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("brimble_access_token="));
    setOpen(hasAuthToken && readCookieConsent() === null);
  }, []);

  function handleChoice(choice: CookieConsentChoice) {
    saveCookieConsent(choice);
    setOpen(false);
    void syncCookieConsent(choice);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.section
          role="dialog"
          aria-label="Cookie consent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-3 bottom-3 z-[70] mx-auto w-auto max-w-[720px] rounded-2xl border border-[rgba(152,157,164,0.32)] bg-brimble-air-gray/95 p-4 shadow-[var(--shadow-big)] backdrop-blur-xl dark:border-white/12 dark:bg-[#1a1c1e]/95"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-[520px] text-sm leading-6 tracking-[-0.02em] text-brimble-black/70 dark:text-white/70">
              We use cookies to remember your preferences and improve the
              website experience. See our{" "}
              <Link
                to="/legal/$slug"
                params={{ slug: "privacy" }}
                className="font-medium text-[#006fff] underline underline-offset-2 hover:opacity-80"
              >
                Privacy Policy
              </Link>
              .
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="pill-light"
                size="sm"
                className="px-3"
                onClick={() => handleChoice("declined")}
              >
                Decline
              </Button>
              <Button
                variant="pill"
                size="sm"
                className="px-3"
                onClick={() => handleChoice("accepted")}
              >
                Accept
              </Button>
            </div>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
