import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import type {
  AddPaymentMethodInput,
  CreateSubscriptionInput,
  SwapPlanInput,
  PurchaseInput,
  UpdateSpendingLimitInput,
  UpdateTeamSubscriptionInput,
} from "@/backend/payments";
import config from "@/config";
import { getServerAccessToken } from "@/server/auth/cookies";

function getServerBackendApi() {
  return createBackendApi({
    baseUrl: config.apiUrl,
    getAccessToken: getServerAccessToken,
  });
}

/* ── Queries ── */

export const getPaymentMethodsServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return getServerBackendApi().payments.listPaymentMethods();
});

export const getSubscriptionServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return getServerBackendApi().payments.getSubscription();
});

export const getBillEstimateServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return getServerBackendApi().payments.getBillEstimate();
});

export const getPaymentInvoicesServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as unknown as { cursor?: string | null; per_page?: number; team_id?: string } | undefined;
  const perPage = typeof payload?.per_page === "number" ? Math.max(1, Math.min(100, payload.per_page)) : 10;
  return getServerBackendApi().payments.listInvoices({
    cursor: payload?.cursor?.trim() || null,
    per_page: perPage,
    ...(payload?.team_id ? { team_id: payload.team_id } : {}),
  });
});

/* ── Mutations ── */

export const createSetupIntentServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  return getServerBackendApi().payments.createSetupIntent();
});

export const addPaymentMethodServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as AddPaymentMethodInput;
  return getServerBackendApi().payments.addPaymentMethod(input);
});

export const removePaymentMethodServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as { payment_method_id: string };
  await getServerBackendApi().payments.removePaymentMethod(input.payment_method_id);
  return { ok: true } as const;
});

export const setDefaultPaymentMethodServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as { payment_method_id: string };
  await getServerBackendApi().payments.setDefaultPaymentMethod(input.payment_method_id);
  return { ok: true } as const;
});

export const createSubscriptionServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as CreateSubscriptionInput;
  return getServerBackendApi().payments.createSubscription(input);
});

export const swapPlanServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as SwapPlanInput;
  return getServerBackendApi().payments.swapPlan(input);
});

export const cancelSubscriptionServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  await getServerBackendApi().payments.cancelSubscription();
  return { ok: true } as const;
});

export const purchaseServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as PurchaseInput;
  return getServerBackendApi().payments.purchase(input);
});

export const updateSpendingLimitServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateSpendingLimitInput;
  await getServerBackendApi().payments.updateSpendingLimit(input);
  return { ok: true } as const;
});

export const updateTeamSubscriptionServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateTeamSubscriptionInput;
  await getServerBackendApi().payments.updateTeamSubscription(input);
  return { ok: true } as const;
});
