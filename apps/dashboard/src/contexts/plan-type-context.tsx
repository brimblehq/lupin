/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react";

const PlanTypeContext = createContext<string | undefined>(undefined);

export function PlanTypeProvider({ value, children }: { value: string | undefined; children: ReactNode }) {
  return <PlanTypeContext value={value}>{children}</PlanTypeContext>;
}

export function usePlanType(): string | undefined {
  return useContext(PlanTypeContext);
}
