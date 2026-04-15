import config from "@/config";

let initialized = false;
let surveyBlockObserver: MutationObserver | null = null;
let surveyBlockRetryBound = false;
let posthogClientPromise: Promise<PostHogClient | null> | null = null;

const SURVEY_BLOCK_STYLE_ID = "brimble-posthog-survey-block-style";
const SURVEY_CONTAINER_SELECTOR = '[class^="PostHogSurvey-"], [class*=" PostHogSurvey-"], [class*="PostHogSurvey-"]';
const SURVEY_BRANDING_SELECTOR = 'a.footer-branding[href*="posthog.com/surveys"], a[href*="posthog.com/surveys"], .footer-branding';
const SURVEY_SUBMIT_SELECTOR = 'button.form-submit[aria-label="Submit survey"]';

type PostHogClient = {
  init: (apiKey: string, config?: Record<string, unknown>) => void;
  set_config: (config: Record<string, unknown>) => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
  isFeatureEnabled?: (flag: string) => boolean | undefined;
  onFeatureFlags?: (callback: () => void) => void;
  offFeatureFlags?: (callback: () => void) => void;
};

function shouldEnablePostHog(): boolean {
  if (!config.posthogKey) return false;

  // const viteEnv =
  //   typeof import.meta !== "undefined"
  //     ? ((import.meta as ImportMeta).env as
  //         | { DEV?: boolean }
  //         | undefined)
  //     : undefined;
  // if (viteEnv?.DEV) return false;

  // const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  //   .process?.env?.NODE_ENV;
  // if (nodeEnv && nodeEnv !== "production") return false;

  // if (typeof window !== "undefined" && isLocalhostHost(window.location.hostname)) {
  //   return false;
  // }

  return true;
}

export const isPostHogEnabled = shouldEnablePostHog();

async function loadPostHogClient(): Promise<PostHogClient | null> {
  if (typeof window === "undefined" || !isPostHogEnabled) {
    return null;
  }

  if (!posthogClientPromise) {
    posthogClientPromise = import("posthog-js")
      .then((module) => (module.default as PostHogClient) ?? null)
      .catch(() => null);
  }

  return posthogClientPromise;
}

function removeMountedPostHogSurveys() {
  if (typeof document === "undefined") return;

  document.querySelectorAll<HTMLElement>(SURVEY_CONTAINER_SELECTOR).forEach((el) => {
    el.remove();
  });

  document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
    const shadow = el.shadowRoot;
    if (!shadow) return;

    const hasSurveyBranding = !!shadow.querySelector(SURVEY_BRANDING_SELECTOR);
    const hasSurveySubmit = !!shadow.querySelector(SURVEY_SUBMIT_SELECTOR);
    if (hasSurveyBranding || hasSurveySubmit) {
      el.remove();
    }
  });
}

function ensurePostHogSurveyBlockStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(SURVEY_BLOCK_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = SURVEY_BLOCK_STYLE_ID;
  style.textContent = `
${SURVEY_CONTAINER_SELECTOR} {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
`;
  document.head.append(style);
}

function enforcePostHogSurveyBlock() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!document.body) {
    if (!surveyBlockRetryBound) {
      surveyBlockRetryBound = true;
      window.addEventListener(
        "DOMContentLoaded",
        () => {
          surveyBlockRetryBound = false;
          enforcePostHogSurveyBlock();
        },
        { once: true },
      );
    }
    return;
  }

  ensurePostHogSurveyBlockStyle();
  removeMountedPostHogSurveys();

  if (surveyBlockObserver) return;

  surveyBlockObserver = new MutationObserver(() => {
    removeMountedPostHogSurveys();
  });
  surveyBlockObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

export async function initPostHog(): Promise<PostHogClient | null> {
  if (typeof window === "undefined") return null;
  if (initialized) {
    return loadPostHogClient();
  }
  if (!isPostHogEnabled) return null;

  const posthog = await loadPostHogClient();
  if (!posthog) {
    return null;
  }

  enforcePostHogSurveyBlock();

  posthog.init(config.posthogKey, {
    api_host: config.posthogHost,
    defaults: "2026-01-30",
    capture_pageview: false,
    capture_pageleave: true,
    disable_surveys: true,
    disable_surveys_automatic_display: true,
    advanced_enable_surveys: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
    },
  });

  posthog.set_config({
    disable_surveys: true,
    disable_surveys_automatic_display: true,
    advanced_enable_surveys: false,
  });
  enforcePostHogSurveyBlock();

  initialized = true;
  return posthog;
}

export function capturePostHog(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined" || !isPostHogEnabled) return;
  void initPostHog().then((client) => {
    client?.capture(event, properties);
  });
}

export function identifyPostHog(distinctId: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined" || !isPostHogEnabled) return;
  void initPostHog().then((client) => {
    client?.identify(distinctId, properties);
  });
}

export function resetPostHog() {
  if (typeof window === "undefined" || !isPostHogEnabled) return;
  void initPostHog().then((client) => {
    client?.reset();
  });
}

export function subscribePostHogFeatureFlag(flag: string, onChange: (value: boolean | undefined) => void): () => void {
  if (typeof window === "undefined" || !isPostHogEnabled) {
    return () => {};
  }

  let disposed = false;
  let unsubscribe: (() => void) | undefined;

  void initPostHog().then((client) => {
    if (!client || disposed) {
      return;
    }

    onChange(client.isFeatureEnabled?.(flag));

    if (typeof client.onFeatureFlags === "function") {
      const handler = () => onChange(client.isFeatureEnabled?.(flag));
      client.onFeatureFlags(handler);
      unsubscribe = () => {
        if (typeof client.offFeatureFlags === "function") {
          client.offFeatureFlags(handler);
        }
      };
    }
  });

  return () => {
    disposed = true;
    unsubscribe?.();
  };
}

export async function getPostHogFeatureFlag(flag: string): Promise<boolean | undefined> {
  if (typeof window === "undefined" || !isPostHogEnabled) {
    return undefined;
  }

  const client = await initPostHog();
  return client?.isFeatureEnabled?.(flag);
}

export const posthog = {
  capture: capturePostHog,
  identify: identifyPostHog,
  reset: resetPostHog,
};
