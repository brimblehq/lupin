import { createServerFn } from "@tanstack/react-start";
import type {
  AddPaymentMethodInput,
  CreateSubscriptionInput,
  SwapPlanInput,
  PurchaseInput,
  UpdateSpendingLimitInput,
  UpdateTeamSpendingLimitInput,
  UpdateTeamSubscriptionInput,
} from "@/backend/payments";
import { withTokenRefresh } from "@/server/shared/backend";

/* ── Queries ── */

export const getPaymentMethodsServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withTokenRefresh(async (api) => {
    return api.payments.listPaymentMethods();
  });
});

export const getSubscriptionServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withTokenRefresh(async (api) => {
    return api.payments.getSubscription();
  });
});

export const getPaymentInvoicesServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as unknown as { cursor?: string | null; per_page?: number; team_id?: string } | undefined;
  const perPage = typeof payload?.per_page === "number" ? Math.max(1, Math.min(100, payload.per_page)) : 10;

  return withTokenRefresh(async (api) => {
    return api.payments.listInvoices({
      cursor: payload?.cursor?.trim() || null,
      per_page: perPage,
      ...(payload?.team_id ? { team_id: payload.team_id } : {}),
    });
  });
});

export const getSubscriptionStatsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as unknown as { workspace?: string } | undefined;

  return withTokenRefresh(async (api) => {
    let teamId: string | undefined;
    const workspaceSlug = payload?.workspace?.trim().toLowerCase();
    if (workspaceSlug) {
      const teams = await api.workspaces.list();
      const match = teams.items.find((item) => item.slug === workspaceSlug);
      teamId = match?.id ?? undefined;
    }
    return api.payments.getSubscriptionStats(teamId);
  });
});

/* ── Mutations ── */

export const createSetupIntentServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  return withTokenRefresh(async (api) => {
    return api.payments.createSetupIntent();
  });
});

export const addPaymentMethodServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as AddPaymentMethodInput;

  return withTokenRefresh(async (api) => {
    return api.payments.addPaymentMethod(input);
  });
});

export const removePaymentMethodServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as { payment_method_id: string };

  return withTokenRefresh(async (api) => {
    await api.payments.removePaymentMethod(input.payment_method_id);
    return { ok: true } as const;
  });
});

export const setDefaultPaymentMethodServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as { payment_method_id: string };

  return withTokenRefresh(async (api) => {
    await api.payments.setDefaultPaymentMethod(input.payment_method_id);
    return { ok: true } as const;
  });
});

export const createSubscriptionServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as CreateSubscriptionInput;

  return withTokenRefresh(async (api) => {
    return api.payments.createSubscription(input);
  });
});

export const swapPlanServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as SwapPlanInput;

  return withTokenRefresh(async (api) => {
    return api.payments.swapPlan(input);
  });
});

export const cancelSubscriptionServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  return withTokenRefresh(async (api) => {
    await api.payments.cancelSubscription();
    return { ok: true } as const;
  });
});

export const payInvoiceServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as { invoice_id: string; team_id?: string };

  const invoiceId = String(input?.invoice_id ?? "").trim();
  if (!invoiceId) {
    throw new Error("Invoice ID is required");
  }

  return withTokenRefresh(async (api) => {
    return api.payments.payInvoice({
      invoice_id: invoiceId,
      ...(input?.team_id ? { team_id: input.team_id } : {}),
    });
  });
});

export const purchaseServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as PurchaseInput;

  return withTokenRefresh(async (api) => {
    return api.payments.purchase(input);
  });
});

export const verifyTransactionServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { reference?: string } | undefined;
  const reference = payload?.reference?.trim();

  if (!reference) {
    throw new Error("Transaction reference is required");
  }

  return withTokenRefresh(async (api) => {
    return api.payments.verifyTransaction(reference);
  });
});

export const getSpendingLimitStatusServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withTokenRefresh(async (api) => {
    return api.payments.getSpendingLimitStatus();
  });
});

export const updateSpendingLimitServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateSpendingLimitInput;

  return withTokenRefresh(async (api) => {
    await api.payments.updateSpendingLimit(input);
    return { ok: true } as const;
  });
});

export const updateTeamSpendingLimitServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateTeamSpendingLimitInput;

  return withTokenRefresh(async (api) => {
    await api.payments.updateTeamSpendingLimit(input);
    return { ok: true } as const;
  });
});

export const updateTeamSubscriptionServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as UpdateTeamSubscriptionInput;

  return withTokenRefresh(async (api) => {
    await api.payments.updateTeamSubscription(input);
    return { ok: true } as const;
  });
});
