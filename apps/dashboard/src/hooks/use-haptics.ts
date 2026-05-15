import { WebHaptics } from "web-haptics";
import { useEffect, useMemo } from "react";

/**
 * Safari drops user-activation across `await` boundaries, so the library's
 * `await audioCtx.resume()` never unlocks. We pre-warm a shared AudioContext
 * on the very first synchronous user gesture so it's already `running` when
 * web-haptics creates its own context later.
 */
let safariAudioWarmed = false;
function warmSafariAudio() {
  if (safariAudioWarmed) return;
  safariAudioWarmed = true;

  if (typeof AudioContext === "undefined") return;

  const ctx = new AudioContext();
  void ctx.resume().then(() => {
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    src.onended = () => {
      src.disconnect();
      ctx.close();
    };
  });
}

/**
 * Module-level enabled flag. Toggled via setHapticsEnabled() from settings.
 * Defaults to true; the profile loader syncs it on mount.
 */
let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
}

export function getHapticsEnabled() {
  return hapticsEnabled;
}

const PATTERNS = {
  success: {
    segments: [{ duration: 30 }, { delay: 60, duration: 40, intensity: 1 }],
  },
  warning: {
    segments: [
      { duration: 40, intensity: 0.8 },
      { delay: 100, duration: 40, intensity: 0.6 },
    ],
  },
  error: {
    segments: [{ duration: 40 }, { delay: 40, duration: 40 }, { delay: 40, duration: 40 }],
    options: { intensity: 0.9 },
  },
  light: { segments: [{ duration: 15 }], options: { intensity: 0.4 } },
  medium: { segments: [{ duration: 15 }], options: { intensity: 0.4 } },
  heavy: { segments: [{ duration: 35 }], options: { intensity: 1 } },
  soft: { segments: [{ duration: 40 }] },
  rigid: { segments: [{ duration: 10 }], options: { intensity: 1 } },
  selection: { segments: [{ duration: 8 }], options: { intensity: 0.3 } },
  nudge: {
    segments: [
      { duration: 80, intensity: 0.8 },
      { delay: 80, duration: 50, intensity: 0.3 },
    ],
  },
  buzz: { segments: [{ duration: 1000 }], options: { intensity: 1 } },
} as const;

let sharedHaptics: WebHaptics | null = null;
function getSharedHaptics(): WebHaptics | null {
  if (typeof window === "undefined") return null;
  if (!sharedHaptics) {
    sharedHaptics = new WebHaptics({ debug: true, showSwitch: false });
  }
  return sharedHaptics;
}

function fire(key: keyof typeof PATTERNS) {
  if (!hapticsEnabled) return;
  const haptics = getSharedHaptics();
  if (!haptics) return;
  const p = PATTERNS[key];
  haptics.trigger(p.segments as unknown as any[], "options" in p ? (p as any).options : undefined);
}

const hapticsApi = {
  success: () => fire("success"),
  warning: () => fire("warning"),
  error: () => fire("error"),
  light: () => fire("light"),
  medium: () => fire("medium"),
  heavy: () => fire("heavy"),
  soft: () => fire("soft"),
  rigid: () => fire("rigid"),
  selection: () => fire("selection"),
  nudge: () => fire("nudge"),
  buzz: () => fire("buzz"),
};

let warmListenersAttached = false;
function attachWarmListeners() {
  if (warmListenersAttached) return;
  warmListenersAttached = true;

  const handler = () => {
    warmSafariAudio();
    document.removeEventListener("click", handler, true);
    document.removeEventListener("touchstart", handler, true);
  };

  document.addEventListener("click", handler, { capture: true, once: true });
  document.addEventListener("touchstart", handler, { capture: true, once: true });
}

export function useHaptics() {
  useEffect(() => {
    if (safariAudioWarmed) return;
    attachWarmListeners();
  }, []);

  return useMemo(() => hapticsApi, []);
}
