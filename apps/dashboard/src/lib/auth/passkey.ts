import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

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
  return startRegistration({ optionsJSON: options as any });
}

export async function runAuthentication(
  options: Record<string, unknown>,
  useBrowserAutofill = false,
) {
  return startAuthentication({
    optionsJSON: options as any,
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
  if (!(error instanceof Error)) return "Passkey operation failed. Try again.";
  const msg = error.message || "";
  const lower = msg.toLowerCase();
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
  if (lower.includes("notallowed")) {
    return "Passkey prompt was cancelled.";
  }
  if (lower.includes("rp id") && lower.includes("invalid")) {
    return "Passkeys aren't configured for this site yet. Please try again later or contact support.";
  }
  if (lower.includes("securityerror") || lower.includes("relying party")) {
    return "Passkeys aren't configured for this site yet. Please try again later or contact support.";
  }
  return msg;
}
