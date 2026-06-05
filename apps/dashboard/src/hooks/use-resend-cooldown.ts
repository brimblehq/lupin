import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;
const ONE_SECOND_MS = 1000;

export function useResendCooldown(cooldownSeconds = DEFAULT_RESEND_COOLDOWN_SECONDS) {
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!deadlineAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, ONE_SECOND_MS);

    return () => window.clearInterval(interval);
  }, [deadlineAt]);

  const remainingSeconds = useMemo(() => {
    if (!deadlineAt) {
      return 0;
    }

    const remainingMs = deadlineAt - now;
    return Math.max(0, Math.ceil(remainingMs / ONE_SECOND_MS));
  }, [deadlineAt, now]);

  useEffect(() => {
    if (deadlineAt && remainingSeconds === 0) {
      setDeadlineAt(null);
    }
  }, [deadlineAt, remainingSeconds]);

  const startCooldown = useCallback(() => {
    const nextDeadline = Date.now() + cooldownSeconds * ONE_SECOND_MS;
    setNow(Date.now());
    setDeadlineAt(nextDeadline);
  }, [cooldownSeconds]);

  return {
    isCoolingDown: remainingSeconds > 0,
    remainingSeconds,
    startCooldown,
  };
}
