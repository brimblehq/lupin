import posthog from "posthog-js";
import config from "@/config";

let initialized = false;
let surveyBlockObserver: MutationObserver | null = null;
let surveyBlockRetryBound = false;

const SURVEY_BLOCK_STYLE_ID = "brimble-posthog-survey-block-style";
const SURVEY_CONTAINER_SELECTOR =
  '[class^="PostHogSurvey-"], [class*=" PostHogSurvey-"], [class*="PostHogSurvey-"]';
const SURVEY_BRANDING_SELECTOR =
  'a.footer-branding[href*="posthog.com/surveys"], a[href*="posthog.com/surveys"], .footer-branding';
const SURVEY_SUBMIT_SELECTOR = 'button.form-submit[aria-label="Submit survey"]';

function isLocalhostHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

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

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (initialized) return;
  if (!isPostHogEnabled) return;

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
}

export { posthog };
