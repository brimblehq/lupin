import posthog from "posthog-js";
import config from "@/config";

let initialized = false;

function isLocalhostHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function shouldEnablePostHog(): boolean {
  if (!config.posthogKey) return false;

  const viteEnv =
    typeof import.meta !== "undefined"
      ? ((import.meta as ImportMeta).env as
          | { DEV?: boolean }
          | undefined)
      : undefined;
  if (viteEnv?.DEV) return false;

  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.NODE_ENV;
  if (nodeEnv && nodeEnv !== "production") return false;

  if (typeof window !== "undefined" && isLocalhostHost(window.location.hostname)) {
    return false;
  }

  return true;
}

export const isPostHogEnabled = shouldEnablePostHog();

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (initialized) return;
  if (!isPostHogEnabled) return;

  posthog.init(config.posthogKey, {
    api_host: config.posthogHost,
    defaults: "2026-01-30",
    capture_pageview: false,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
    },
  });

  initialized = true;
}

export { posthog };
