import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_PRICING } from "@/utils/default-pricing";
import type { Pricing } from "@/types/pricing";

const PricingContext = createContext<Pricing>(DEFAULT_PRICING);

export function PricingProvider({ value, children }: { value: Pricing; children: ReactNode }) {
  return <PricingContext value={value}>{children}</PricingContext>;
}

export function usePricing(): Pricing {
  return useContext(PricingContext);
}
