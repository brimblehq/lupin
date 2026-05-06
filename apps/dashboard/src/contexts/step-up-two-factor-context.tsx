import { useCallback, useRef, useState, type ReactNode } from "react";
import { StepUpTwoFactorModal } from "@/components/shared/step-up-two-factor-modal";
import { StepUpTwoFactorContext } from "@/hooks/use-step-up-two-factor";
import type { StepUpRequirement } from "@/lib/auth/two-factor-step-up";

interface PendingPrompt {
  requirement: StepUpRequirement;
  resolve: (token: string | null) => void;
}

export function StepUpTwoFactorProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const pendingRef = useRef<PendingPrompt | null>(null);

  const requestStepUp = useCallback((requirement: StepUpRequirement) => {
    return new Promise<string | null>((resolve) => {
      const next: PendingPrompt = { requirement, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const resolvePending = useCallback((token: string | null) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(token);
  }, []);

  return (
    <StepUpTwoFactorContext.Provider value={{ requestStepUp }}>
      {children}
      <StepUpTwoFactorModal
        open={Boolean(pending)}
        requirement={pending?.requirement ?? null}
        onResolve={(token) => resolvePending(token)}
        onCancel={() => resolvePending(null)}
      />
    </StepUpTwoFactorContext.Provider>
  );
}
