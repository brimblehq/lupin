import { toast as sonnerToast } from "sonner";
import { getHapticsEnabled } from "@/hooks/use-haptics";

function vibrate(pattern: number[]) {
  if (!getHapticsEnabled()) return;
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

const VIBRATE = {
  success: [30, 60, 40],
  error: [40, 40, 40, 40, 40],
  warning: [40, 100, 40],
};

const REPORT_ERROR_EMAIL = "hello@brimble.app";
const REPORT_ERROR_SUBJECT = "Dashboard Error Report";

function getProjectIdFromUrl(url: string): string | undefined {
  const match = url.match(/\/projects\/([^/?#]+)/);
  return match?.[1];
}

function buildReportErrorBody(message?: string): string {
  const timestamp = new Date().toISOString();
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const projectId = getProjectIdFromUrl(currentUrl);
  const lines = [
    "Hi Brimble team,",
    "",
    "I encountered an error in the dashboard.",
    "",
    `Error message: ${message || "N/A"}`,
    `Page URL: ${currentUrl || "N/A"}`,
    `Project ID: ${projectId || "N/A"}`,
    `Time (UTC): ${timestamp}`,
    "",
    "What I was doing:",
    "[Please describe what you were doing when this happened]",
    "",
    "Expected result:",
    "[Please describe what you expected to happen]",
    "",
    "Actual result:",
    "[Please describe what happened instead]",
  ];

  return lines.join("\n");
}

function getToastMessageText(message: unknown): string | undefined {
  if (typeof message !== "string") {
    return undefined;
  }

  const trimmed = message.trim();
  return trimmed || undefined;
}

function openErrorReportMail(message?: string) {
  if (typeof window === "undefined") {
    return;
  }

  const subject = encodeURIComponent(REPORT_ERROR_SUBJECT);
  const body = encodeURIComponent(buildReportErrorBody(message));
  window.location.href = `mailto:${REPORT_ERROR_EMAIL}?subject=${subject}&body=${body}`;
}

export const hapticToast = Object.assign((...args: Parameters<typeof sonnerToast>) => sonnerToast(...args), {
  ...sonnerToast,
  success: (...args: Parameters<typeof sonnerToast.success>) => {
    vibrate(VIBRATE.success);
    return sonnerToast.success(...args);
  },
  error: (message: Parameters<typeof sonnerToast.error>[0], options?: Parameters<typeof sonnerToast.error>[1]) => {
    vibrate(VIBRATE.error);
    const messageText = getToastMessageText(message);
    const hasCustomAction = Boolean(options?.action);

    return sonnerToast.error(message, {
      ...options,
      action: hasCustomAction
        ? options?.action
        : {
            label: "Report error",
            onClick: () => openErrorReportMail(messageText),
          },
    });
  },
  warning: (...args: Parameters<typeof sonnerToast.warning>) => {
    vibrate(VIBRATE.warning);
    return sonnerToast.warning(...args);
  },
});
