import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPaymentMethodsServerFn,
  getSubscriptionServerFn,
  getPaymentInvoicesServerFn,
  createSetupIntentServerFn,
  addPaymentMethodServerFn,
  removePaymentMethodServerFn,
  setDefaultPaymentMethodServerFn,
  createSubscriptionServerFn,
  swapPlanServerFn,
  cancelSubscriptionServerFn,
  payInvoiceServerFn,
  purchaseServerFn,
  updateSpendingLimitServerFn,
  updateTeamSpendingLimitServerFn,
  getSpendingLimitStatusServerFn,
} from "@/server/payments/actions";

/* ── Query key factory ── */

export const paymentKeys = {
  all: ["payments"] as const,
  methods: () => [...paymentKeys.all, "methods"] as const,
  subscription: () => [...paymentKeys.all, "subscription"] as const,
  spendingLimitStatus: (teamId?: string) => [...paymentKeys.all, "spending-limit-status", teamId ?? "personal"] as const,
  invoices: (cursor: string | null, teamId?: string) => [...paymentKeys.all, "invoices", cursor ?? "first", teamId ?? "personal"] as const,
};

/* ── Typed server function callers ── */

const getInvoices = getPaymentInvoicesServerFn as unknown as (args: {
  data: { cursor?: string | null; per_page?: number; team_id?: string };
}) => Promise<any>;

const addMethod = addPaymentMethodServerFn as unknown as (args: { data: { payment_method: string } }) => Promise<any>;

const removeMethod = removePaymentMethodServerFn as unknown as (args: { data: { payment_method_id: string } }) => Promise<any>;

const setDefault = setDefaultPaymentMethodServerFn as unknown as (args: { data: { payment_method_id: string } }) => Promise<any>;

const createSub = createSubscriptionServerFn as unknown as (args: {
  data: { type: string; payment_method?: string; accept_terms: boolean };
}) => Promise<any>;

const swap = swapPlanServerFn as unknown as (args: { data: { target_plan: string } }) => Promise<any>;

const purchase = purchaseServerFn as unknown as (args: {
  data: {
    type: "PURCHASE_DOMAIN" | "RENEW_DOMAIN" | "SERVICE_PURCHASE" | "LLM_TOKENS" | "BUILD_MINUTES";
    amount: number;
    metadata: Record<string, unknown>;
    team_id?: string;
  };
}) => Promise<any>;

const payInvoice = payInvoiceServerFn as unknown as (args: {
  data: { invoice_id: string; team_id?: string };
}) => Promise<any>;

const updateLimit = updateSpendingLimitServerFn as unknown as (args: { data: { spending_limit: number } }) => Promise<any>;

const updateTeamLimit = updateTeamSpendingLimitServerFn as unknown as (args: {
  data: { team_id: string; spending_limit: number };
}) => Promise<any>;

const getSpendingLimitStatus = getSpendingLimitStatusServerFn as unknown as (args?: {
  data?: { team_id?: string };
}) => Promise<any>;

/* ── Queries ── */

export function usePaymentMethods(initialData?: any[]) {
  return useQuery({
    queryKey: paymentKeys.methods(),
    queryFn: () => getPaymentMethodsServerFn(),
    ...(initialData ? { initialData } : {}),
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: paymentKeys.subscription(),
    queryFn: () => getSubscriptionServerFn(),
  });
}

export function useInvoices(cursor?: string | null, teamId?: string, initialData?: any) {
  const isFirstPage = !cursor;
  const hasInitialData = isFirstPage && initialData?.items?.length > 0;
  return useQuery({
    queryKey: paymentKeys.invoices(cursor ?? null, teamId),
    queryFn: () => getInvoices({ data: { cursor: cursor ?? null, ...(teamId ? { team_id: teamId } : {}) } }),
    placeholderData: (prev: any) => prev,
    ...(hasInitialData ? { initialData } : {}),
  });
}

export function useSpendingLimitStatus(teamId?: string) {
  return useQuery({
    queryKey: paymentKeys.spendingLimitStatus(teamId),
    queryFn: () => {
      if (!teamId) {
        return getSpendingLimitStatus();
      }

      return getSpendingLimitStatus({ data: { team_id: teamId } });
    },
  });
}

/* ── Mutations ── */

export function useCreateSetupIntent() {
  return useMutation({
    mutationFn: () => createSetupIntentServerFn(),
  });
}

export function useAddPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentMethodId: string) => addMethod({ data: { payment_method: paymentMethodId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

export function useRemovePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentMethodId: string) => removeMethod({ data: { payment_method_id: paymentMethodId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

export function useSetDefaultPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentMethodId: string) => setDefault({ data: { payment_method_id: paymentMethodId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: string; payment_method?: string; accept_terms: boolean }) => createSub({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentKeys.subscription() });
      void qc.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

export function useSwapPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetPlan: string) => swap({ data: { target_plan: targetPlan } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentKeys.subscription() });
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cancelSubscriptionServerFn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentKeys.subscription() });
    },
  });
}

export function usePayInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { invoice_id: string; team_id?: string }) => payInvoice({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...paymentKeys.all, "invoices"] });
      void qc.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

export function usePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type: "PURCHASE_DOMAIN" | "RENEW_DOMAIN" | "SERVICE_PURCHASE" | "LLM_TOKENS" | "BUILD_MINUTES";
      amount: number;
      metadata: Record<string, unknown>;
      team_id?: string;
    }) => purchase({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...paymentKeys.all, "invoices"] });
    },
  });
}

export function useUpdateSpendingLimit(teamId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (spendingLimit: number) =>
      teamId
        ? updateTeamLimit({
            data: { team_id: teamId, spending_limit: spendingLimit },
          })
        : updateLimit({ data: { spending_limit: spendingLimit } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentKeys.spendingLimitStatus(teamId) });
    },
  });
}
