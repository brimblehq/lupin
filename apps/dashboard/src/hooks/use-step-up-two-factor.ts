import { createContext, useContext } from "react";
import type { StepUpRequirement } from "@/lib/auth/two-factor-step-up";

export interface StepUpTwoFactorContextValue {
  /**
   * Open the step-up modal and resolve with a one-time token, or null if
   * the user cancelled. Token is single-use; pass to the protected server
   * fn under `twoFactorToken` and discard immediately.
   */
  requestStepUp: (req: StepUpRequirement) => Promise<string | null>;
}

export const StepUpTwoFactorContext = createContext<StepUpTwoFactorContextValue | null>(null);

export function useStepUpTwoFactor() {
  const ctx = useContext(StepUpTwoFactorContext);
  if (!ctx) throw new Error("useStepUpTwoFactor must be used within StepUpTwoFactorProvider");
  return ctx;
}
