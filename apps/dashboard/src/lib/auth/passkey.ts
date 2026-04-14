import { browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, startAuthentication, startRegistration } from "@simplewebauthn/browser";

export function isPasskeySupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
}

export async function isPasskeyAutofillSupported(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  try {
    return await browserSupportsWebAuthnAutofill();
  } catch {
    return false;
  }
}

export async function runRegistration(options: Record<string, unknown>) {
  const optionsJSON = normalizeRegistrationOptions(options);
  return startRegistration({ optionsJSON: optionsJSON as any });
}

export async function runAuthentication(options: Record<string, unknown>, useBrowserAutofill = false) {
  const optionsJSON = normalizeAuthenticationOptions(options, useBrowserAutofill);
  return startAuthentication({
    optionsJSON: optionsJSON as any,
    useBrowserAutofill,
  });
}

export function guessDeviceName(): string {
  if (typeof navigator === "undefined") return "My device";
  const ua = navigator.userAgent || "";
  let os = "Device";
  if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Macintosh|Mac OS X/i.test(ua)) os = "Mac";
  else if (/Windows/i.test(ua)) os = "Windows PC";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  return browser ? `${os} (${browser})` : os;
}

export function passkeyErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Passkey operation failed. Please try again.";
  const msg = error.message || "";
  const lower = msg.toLowerCase();
  const name = getErrorName(error);
  const causeName = getErrorName((error as any).cause);

  if (
    name === "NotAllowedError" ||
    causeName === "NotAllowedError" ||
    lower.includes("notallowederror") ||
    lower.includes("not allowed") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("cancelled") ||
    lower.includes("canceled") ||
    lower.includes("abort")
  ) {
    return "Passkey request was canceled.";
  }

  if (lower.includes("user verification")) {
    return "Use Touch ID or your device PIN to continue.";
  }
  if (lower.includes("invalid or expired challenge")) {
    return "That session expired. Please try again.";
  }
  if (lower.includes("already registered")) {
    return "This device already has a passkey on your account.";
  }
  if (lower.includes("insufficient token scope")) {
    return "This action requires you to start over.";
  }
  if (lower.includes("invalid passkey credential")) {
    return "That passkey didn't work. Try again.";
  }
  if (lower.includes("too many requests")) {
    return "Too many attempts — please wait a moment and try again.";
  }
  if (lower.includes("rp id") && lower.includes("invalid")) {
    return "Passkeys aren't configured for this site yet. Please try again later or contact support.";
  }
  if (lower.includes("securityerror") || lower.includes("relying party")) {
    return "Passkeys aren't configured for this site yet. Please try again later or contact support.";
  }
  return "Passkey operation failed. Please try again.";
}

function getErrorName(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const maybeName = (value as { name?: unknown }).name;
  return typeof maybeName === "string" ? maybeName : "";
}

function normalizeRegistrationOptions(options: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...options };

  const rawSelection = normalized.authenticatorSelection;
  const selection: Record<string, unknown> =
    rawSelection && typeof rawSelection === "object" ? { ...(rawSelection as Record<string, unknown>) } : {};

  if (selection.residentKey == null) selection.residentKey = "preferred";
  if (selection.requireResidentKey == null) selection.requireResidentKey = selection.residentKey === "required";
  if (selection.userVerification == null) selection.userVerification = "preferred";
  if (selection.authenticatorAttachment == null) selection.authenticatorAttachment = "platform";

  normalized.authenticatorSelection = selection;

  const existingHints = Array.isArray(normalized.hints)
    ? normalized.hints.filter((value): value is string => typeof value === "string")
    : [];
  const dedupedHints = ["client-device", ...existingHints].filter((hint, index, all) => all.indexOf(hint) === index);
  normalized.hints = dedupedHints;

  return normalized;
}

function normalizeAuthenticationOptions(options: Record<string, unknown>, useBrowserAutofill: boolean): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...options };

  const rawAllowCredentials = normalized.allowCredentials;
  if (Array.isArray(rawAllowCredentials)) {
    normalized.allowCredentials = rawAllowCredentials.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;

      const descriptor: Record<string, unknown> = {
        ...(entry as Record<string, unknown>),
      };
      const rawTransports = Array.isArray(descriptor.transports) ? descriptor.transports : [];
      const transports = rawTransports.filter((value): value is string => typeof value === "string").map((value) => value.toLowerCase());

      if (transports.includes("internal")) {
        descriptor.transports = transports.filter((value) => value !== "hybrid");
      }

      return descriptor;
    });
  }

  if (!useBrowserAutofill) {
    const existingHints = Array.isArray(normalized.hints)
      ? normalized.hints.filter((value): value is string => typeof value === "string")
      : [];
    const dedupedHints = ["client-device", ...existingHints].filter((hint, index, all) => all.indexOf(hint) === index);
    normalized.hints = dedupedHints;
  }

  return normalized;
}
