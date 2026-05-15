import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

const SHOW_DELAY_MS = 100;
const FADE_OUT_MS = 250;

export function RouterProgressBar() {
  const status = useRouterState({ select: (s) => s.status });
  const [phase, setPhase] = useState<"idle" | "loading" | "finishing">("idle");

  useEffect(() => {
    if (status === "pending") {
      const t = window.setTimeout(() => setPhase("loading"), SHOW_DELAY_MS);
      return () => window.clearTimeout(t);
    }
    setPhase((prev) => (prev === "loading" ? "finishing" : "idle"));
  }, [status]);

  useEffect(() => {
    if (phase !== "finishing") return;
    const t = window.setTimeout(() => setPhase("idle"), FADE_OUT_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "idle") return null;

  return (
    <div
      aria-hidden="true"
      data-phase={phase}
      className="router-progress pointer-events-none fixed left-0 top-0 z-[2000] h-[2px] origin-left bg-[#006fff] dark:bg-[#b27a22]"
    />
  );
}
