import { useWebHaptics } from "web-haptics/react";
import { useMemo } from "react";

const PATTERNS = {
  success: {
    segments: [
      { duration: 30 },
      { delay: 60, duration: 40, intensity: 1 },
    ],
  },
  warning: {
    segments: [
      { duration: 40, intensity: 0.8 },
      { delay: 100, duration: 40, intensity: 0.6 },
    ],
  },
  error: {
    segments: [
      { duration: 40 },
      { delay: 40, duration: 40 },
      { delay: 40, duration: 40 },
    ],
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

export function useHaptics() {
  const { trigger } = useWebHaptics({
    debug: true,
    showSwitch: false,
  });
  return useMemo(() => {
    const fire = (key: keyof typeof PATTERNS) => {
      const p = PATTERNS[key];
      trigger(
        p.segments as unknown as any[],
        "options" in p ? (p as any).options : undefined,
      );
    };
    return {
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
  }, [trigger]);
}
