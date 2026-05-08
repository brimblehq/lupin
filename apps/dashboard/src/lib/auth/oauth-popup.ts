import { Realtime } from "ably";
import config from "@/config";
import { extractTwoFactorChallenge, parseTwoFactorChallengeHash } from "./two-factor";

export type OauthProvider = "github" | "google" | "gitlab" | "bitbucket";

export interface OauthAuthEventPayload {
  access_token?: string;
  refresh_token?: string;
  id?: string;
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  onboard?: {
    user?: boolean;
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

function buildOauthUrl(provider: OauthProvider, deviceId: string) {
  const base = config.authApiUrl.endsWith("/") ? config.authApiUrl : `${config.authApiUrl}/`;
  const url = new URL(`signin/${provider}`, base);
  url.searchParams.set("device", deviceId);
  url.searchParams.set("type", "signin");
  return url.toString();
}

export async function startOauthPopup(provider: OauthProvider, opts?: { timeoutMs?: number }): Promise<OauthAuthEventPayload> {
  const deviceId = getOauthDeviceId();
  const timeoutMs = opts?.timeoutMs ?? 120_000;

  const popup = window.open(buildOauthUrl(provider, deviceId), "_blank", "width=600,height=600");

  if (!popup) {
    throw new Error("Popup blocked. Please allow popups and try again.");
  }

  const ably = new Realtime({
    authUrl: `${config.apiUrl}/v1/ably/token?clientId=${deviceId}`,
    clientId: deviceId,
  });

  const channel = ably.channels.get(deviceId);

  return await new Promise<OauthAuthEventPayload>((resolve, reject) => {
    let settled = false;

    function tryExtractAuth(obj: any): OauthAuthEventPayload | null {
      if (!obj || typeof obj !== "object") return null;

      const challenge = extractTwoFactorChallenge(obj);
      if (challenge) {
        return {
          requires_2fa: true,
          challenge_token: challenge.challengeToken,
          expires_in: challenge.expiresIn,
        };
      }

      if (obj.access_token) {
        return obj as OauthAuthEventPayload;
      }

      if (obj.data && typeof obj.data === "object") {
        return tryExtractAuth(obj.data);
      }

      return null;
    }

    function handlePostMessage(event: MessageEvent) {
      const raw = event.data;
      if (!raw || typeof raw !== "object") return;
      if (raw?.name === "metamask-provider") return;
      if (typeof raw === "string" && raw.includes("stripe")) return;

      const result = tryExtractAuth(raw);
      if (result) {
        finish(() => resolve(result));
      }
    }

    window.addEventListener("message", handlePostMessage);
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
      window.removeEventListener("message", handlePostMessage);

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      clearInterval(popupPollId);

      try {
        channel.unsubscribe("auth");
      } catch {
        // noop
      }

      try {
        ably.close();
      } catch {
        // noop
      }
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

    channel.subscribe("auth", (message: any) => {
      const data = message?.data as OauthAuthEventPayload | undefined;

      const challenge = extractTwoFactorChallenge(data);
      if (challenge) {
        finish(() =>
          resolve({
            ...data,
            requires_2fa: true,
            challenge_token: challenge.challengeToken,
            expires_in: challenge.expiresIn,
          }),
        );
        return;
      }

      if (!data?.access_token) {
        finish(() => reject(new Error("Invalid OAuth response from server.")));
        return;
      }

      finish(() => resolve(data));
    });
  });
}
