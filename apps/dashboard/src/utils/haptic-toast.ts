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

export const REPORT_ERROR_EVENT = "brimble:report-error";

export interface ReportErrorEventDetail {
  message?: string;
}

function getToastMessageText(message: unknown): string | undefined {
  if (typeof message !== "string") {
    return undefined;
  }

  const trimmed = message.trim();
  return trimmed || undefined;
}

export function openErrorReport(message?: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<ReportErrorEventDetail>(REPORT_ERROR_EVENT, { detail: { message } }));
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
            onClick: () => openErrorReport(messageText),
          },
    });
  },
  warning: (...args: Parameters<typeof sonnerToast.warning>) => {
    vibrate(VIBRATE.warning);
    return sonnerToast.warning(...args);
  },
});
