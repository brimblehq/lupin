import { createServerFn } from "@tanstack/react-start";
import type {
  AddPaymentMethodInput,
  CreateSubscriptionInput,
  SwapPlanInput,
  CancelSubscriptionInput,
  PurchaseInput,
  UpdateSpendingLimitInput,
  UpdateTeamSpendingLimitInput,
  UpdateTeamSubscriptionInput,
} from "@/backend/payments";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";

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
    const teamId = await resolveTeamId(api, payload?.workspace);
    return api.payments.getSubscriptionStats(teamId);
  });
});

/* ── Mutations ── */

export const addPaymentMethodServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const input = data as unknown as AddPaymentMethodInput;
  const paymentMethod = String(input?.payment_method ?? "").trim();
  const returnUrl = String(input?.return_url ?? "").trim();

  if (!paymentMethod) {
    throw new Error("Payment method is required");
  }

  if (!returnUrl) {
    throw new Error("Return URL is required");
  }

  return withTokenRefresh(async (api) => {
    return api.payments.addPaymentMethod({
      payment_method: paymentMethod,
      return_url: returnUrl,
    });
  });
});

export const confirmPaymentMethodServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as unknown as { setup_intent_id?: string } | undefined;
  const setupIntentId = String(payload?.setup_intent_id ?? "").trim();

  if (!setupIntentId) {
    throw new Error("Setup intent ID is required");
  }

  return withTokenRefresh(async (api) => {
    await api.payments.confirmPaymentMethod(setupIntentId);
    return { ok: true } as const;
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
}).handler(async ({ data }) => {
  const input = data as unknown as CancelSubscriptionInput;
  const comment = String(input?.comment ?? "").trim();
  if (!comment) {
    throw new Error("Please tell us why you're cancelling.");
  }
  if (comment.length > 500) {
    throw new Error("Feedback must be 500 characters or fewer.");
  }

  return withTokenRefresh(async (api) => {
    await api.payments.cancelSubscription({ comment });
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
}).handler(async ({ data }) => {
  const payload = data as { team_id?: string } | undefined;
  let teamId: string | undefined;
  if (typeof payload?.team_id === "string") {
    const normalizedTeamId = payload.team_id.trim();
    if (normalizedTeamId.length > 0) {
      teamId = normalizedTeamId;
    }
  }

  return withTokenRefresh(async (api) => {
    return api.payments.getSpendingLimitStatus(teamId);
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
