import config from "@/config";
import { extractTwoFactorChallenge, parseTwoFactorChallengeHash } from "./two-factor";
import { refreshSessionServerFn } from "@/server/auth/actions";
import type { RefreshSessionServerResult } from "./types";

export type OauthProvider = "github" | "google" | "gitlab" | "bitbucket";

export interface OauthAuthEventPayload {
  status?: "success";
  user?: {
    id?: string;
    firstName?: string;
  };
  requires_2fa?: boolean;
  challenge_token?: string;
  expires_in?: number;
}

const OAUTH_DEVICE_ID_KEY = "brimble.oauth.device_id";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

export function getOauthDeviceId() {
  if (typeof window === "undefined") {
    return "server";
  }

  const existing = window.sessionStorage.getItem(OAUTH_DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const next = randomId();
  window.sessionStorage.setItem(OAUTH_DEVICE_ID_KEY, next);
  return next;
}

function buildOauthUrl(provider: OauthProvider) {
  const base = config.authApiUrl.endsWith("/") ? config.authApiUrl : `${config.authApiUrl}/`;
  const url = new URL(`signin/${provider}`, base);
  url.searchParams.set("type", "login");
  return url.toString();
}

const refreshSession = refreshSessionServerFn as unknown as () => Promise<RefreshSessionServerResult>;
const SESSION_SYNC_POLL_INTERVAL_MS = 500;
const SESSION_SYNC_TIMEOUT_MS = 12_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (Object.prototype.toString.call(value) !== "[object Object]") {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (Object.prototype.toString.call(value) !== "[object String]") {
    return undefined;
  }

  return value as string;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (Object.prototype.toString.call(value) !== "[object Number]") {
    return undefined;
  }

  const parsed = value as number;
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function synchronizeSessionFromRefreshCookie(): Promise<{ id?: string; firstName?: string } | undefined> {
  const deadline = Date.now() + SESSION_SYNC_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const result = await refreshSession();
      if (result.status === "ok") {
        return result.user;
      }

      if (result.status === "expired" || result.status === "error") {
        break;
      }
    } catch {
      // Retry until timeout because cookie propagation can lag briefly after popup auth success.
    }

    await delay(SESSION_SYNC_POLL_INTERVAL_MS);
  }

  throw new Error("Sign in completed, but session sync failed. Please refresh and try again.");
}

export async function startOauthPopup(provider: OauthProvider, opts?: { timeoutMs?: number }): Promise<OauthAuthEventPayload> {
  getOauthDeviceId();
  const timeoutMs = opts?.timeoutMs ?? 120_000;

  const popup = window.open(buildOauthUrl(provider), "_blank", "width=600,height=600");

  if (!popup) {
    throw new Error("Popup blocked. Please allow popups and try again.");
  }

  return await new Promise<OauthAuthEventPayload>((resolve, reject) => {
    let settled = false;

    function tryExtractTwoFactor(obj: unknown): OauthAuthEventPayload | null {
      if (!obj || typeof obj !== "object") return null;
      const record = obj as Record<string, unknown>;

      const challenge = extractTwoFactorChallenge(record);
      if (challenge) {
        return {
          requires_2fa: true,
          challenge_token: challenge.challengeToken,
          expires_in: challenge.expiresIn,
        };
      }

      if (record.data && typeof record.data === "object") {
        return tryExtractTwoFactor(record.data);
      }

      return null;
    }

    async function handlePostMessage(event: MessageEvent<unknown>) {
      const raw = event.data;
      if (!raw) return;
      const rawString = asString(raw);
      if (rawString?.includes("stripe")) return;

      const message = asRecord(raw);
      if (message?.name === "metamask-provider") return;
      if (!message) return;

      if (message.source === "brimble-auth" && message.type === "2fa_required") {
        finish(() =>
          resolve({
            requires_2fa: true,
            challenge_token: asString(message.challenge_token),
            expires_in: asFiniteNumber(message.expires_in),
          }),
        );
        return;
      }

      if (message.source === "brimble-auth" && message.type === "oauth_result") {
        if (message.status !== "success") {
          finish(() => reject(new Error("OAuth did not complete successfully.")));
          return;
        }

        try {
          const user = await synchronizeSessionFromRefreshCookie();
          finish(() =>
            resolve({
              status: "success",
              user,
            }),
          );
        } catch (error) {
          finish(() => reject(error instanceof Error ? error : new Error("Failed to synchronize session.")));
        }
        return;
      }

      const result = tryExtractTwoFactor(message);
      if (result?.requires_2fa) {
        finish(() => resolve(result));
      }
    }

    const handlePostMessageListener = (event: MessageEvent<unknown>) => {
      void handlePostMessage(event);
    };
    window.addEventListener("message", handlePostMessageListener);
    let popupClosedAt: number | null = null;

    const popupPollId = window.setInterval(() => {
      if (popup.closed) {
        if (!popupClosedAt) {
          popupClosedAt = Date.now();
          return;
        }
        if (Date.now() - popupClosedAt > 2000) {
          finish(() => reject(new Error("Sign-in window was closed.")));
        }
        return;
      }

      try {
        const popupUrl = new URL(popup.location.href);
        if (popupUrl.origin !== window.location.origin) {
          return;
        }

        if (popupUrl.pathname !== "/2fa") {
          return;
        }

        const challenge = parseTwoFactorChallengeHash(popupUrl.hash);
        if (!challenge) {
          return;
        }

        finish(() =>
          resolve({
            requires_2fa: true,
            challenge_token: challenge.challengeToken,
            expires_in: challenge.expiresIn,
          }),
        );
      } catch {
        // Ignore cross-origin access errors until popup returns to this origin.
      }
    }, 500);

    const cleanup = () => {
      window.removeEventListener("message", handlePostMessageListener);

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      clearInterval(popupPollId);
    };

    const finish = (fn: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      fn();
    };

    const timeoutId = window.setTimeout(() => {
      finish(() => reject(new Error("OAuth login timed out. Please try again.")));
    }, timeoutMs);
  });
}
