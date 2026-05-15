import config from "@/config";
import { BackendApiError } from "./errors";
import type { ApiClient } from "./types";
import type { BackendClient } from "./client";
import type {
  PaymentsApi,
  PaymentMethod,
  SetupIntentResult,
  AddPaymentMethodInput,
  AddPaymentMethodResult,
  Subscription,
  SubscriptionStats,
  SubscriptionMutationResult,
  CreateSubscriptionInput,
  SwapPlanInput,
  CancelSubscriptionInput,
  InvoicePage,
  InvoicePaymentResult,
  PurchaseInput,
  PurchaseResult,
  VerifyTransactionResult,
  UpdateSpendingLimitInput,
  UpdateTeamSpendingLimitInput,
  UpdateTeamSubscriptionInput,
  SpendingLimitStatus,
} from "./payments/types";

export type { PaymentsApi } from "./payments/types";
export type {
  PaymentMethod,
  PaymentMethodCard,
  SetupIntentResult,
  AddPaymentMethodInput,
  AddPaymentMethodResult,
  AddPaymentMethodPendingData,
  AddPaymentMethodPendingResult,
  AddPaymentMethodSuccessResult,
  Subscription,
  SubscriptionPaymentPendingData,
  SubscriptionMutationResult,
  SubscriptionMutationPendingResult,
  SubscriptionMutationSuccessResult,
  CreateSubscriptionInput,
  SwapPlanInput,
  CancelSubscriptionInput,
  Invoice,
  InvoicePage,
  InvoicePaymentResult,
  PurchaseInput,
  PurchaseResult,
  VerifyTransactionResult,
  UpdateSpendingLimitInput,
  SubscriptionStats,
  UsageBreakdown,
  UsageBreakdownResource,
  UpdateTeamSpendingLimitInput,
  UpdateTeamSubscriptionInput,
  SpendingLimitStatus,
} from "./payments/types";

function unwrapData<T = any>(payload: any): T {
  if (payload?.data?.data !== undefined) return payload.data.data as T;
  if (payload?.data !== undefined) return payload.data as T;
  return payload as T;
}

function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function mapPaymentConfirmationError(error: unknown, fallbackMessage: string): SubscriptionMutationResult {
  if (!(error instanceof BackendApiError) || error.status !== 402) {
    throw error;
  }

  const data = unwrapData<any>(error.details);
  const paymentIntentId = String(data?.payment_intent_id ?? "").trim();
  const clientSecret = typeof data?.client_secret === "string" ? data.client_secret.trim() || null : null;

  if (!paymentIntentId || !clientSecret) {
    throw error;
  }

  return {
    status: "pending",
    message: error.message || fallbackMessage,
    data: {
      requires_action: Boolean(data?.requires_action),
      payment_intent_id: paymentIntentId,
      client_secret: clientSecret,
    },
  };
}

export function createPaymentsApi(client: ApiClient): PaymentsApi {
  const base = config.paymentApiUrl;
  const clientWithConfig = client as BackendClient;
  const serverApiKey = clientWithConfig.config.apiKey?.trim();

  return {
    async listPaymentMethods(): Promise<PaymentMethod[]> {
      const res = await client.request<any>(`${base}/payment/payment-methods`, {
        method: "GET",
      });
      const data = unwrapData<any>(res);
      return Array.isArray(data) ? data : (data?.payment_methods ?? []);
    },

    async createSetupIntent(): Promise<SetupIntentResult> {
      const res = await client.request<any>(`${base}/payment/setup-intent`, {
        method: "POST",
      });
      const data = unwrapData<any>(res);
      return { client_secret: String(data?.client_secret ?? "") };
    },

    async addPaymentMethod(input: AddPaymentMethodInput): Promise<AddPaymentMethodResult> {
      try {
        const res = await client.request<any>(`${base}/payment/payment-method`, {
          method: "POST",
          body: {
            payment_method: input.payment_method,
            return_url: input.return_url,
          },
        });

        const message = res?.message?.trim?.() || "Payment method added successfully";

        return {
          status: "success",
          message,
          data: null,
        };
      } catch (error) {
        if (!(error instanceof BackendApiError) || error.status !== 402) {
          throw error;
        }

        const payload = error.details as any;
        const data = unwrapData<any>(payload);
        const setupIntentId = String(data?.setup_intent_id ?? "").trim();
        const clientSecret = String(data?.client_secret ?? "").trim();
        const redirectUrl = String(data?.redirect_url ?? "").trim();

        if (!setupIntentId || !clientSecret || !redirectUrl) {
          throw new Error("Card confirmation is required, but payment confirmation details are missing.");
        }

        return {
          status: "pending",
          message: error.message || "Card requires 3D Secure confirmation",
          data: {
            requires_action: Boolean(data?.requires_action),
            setup_intent_id: setupIntentId,
            client_secret: clientSecret,
            redirect_url: redirectUrl,
          },
        };
      }
    },

    async confirmPaymentMethod(setupIntentId: string): Promise<void> {
      await client.request(`${base}/payment/payment-method/confirm`, {
        method: "POST",
        body: { setup_intent_id: setupIntentId },
      });
    },

    async removePaymentMethod(id: string): Promise<void> {
      await client.request(`${base}/payment/payment-method/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },

    async setDefaultPaymentMethod(id: string): Promise<void> {
      await client.request(`${base}/payment/default-payment-method`, {
        method: "PUT",
        body: { payment_method_id: id },
      });
    },

    async getSubscription(): Promise<Subscription | null> {
      try {
        const res = await client.request<any>(`${base}/subscription/current-subscription`, { method: "GET" });
        const data = unwrapData<any>(res);
        if (!data) return null;

        const stripeId = typeof data.stripe_id === "string" ? data.stripe_id.trim() : "";
        const planType = typeof data.plan_type === "string" ? data.plan_type : "";

        if (!stripeId || planType.toLowerCase() === "free") return null;

        return {
          id: stripeId,
          plan: planType,
          status: data.stripe_status as Subscription["status"],
          current_period_start: data.current_period_start ?? "",
          current_period_end: data.ends_at ?? "",
          cancel_at_period_end: Boolean(data.ends_at),
          payment_method: data.payment_method,
        };
      } catch {
        return null;
      }
    },

    async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionMutationResult> {
      try {
        const res = await client.request<any>(`${base}/subscription/create`, {
          method: "POST",
          body: {
            type: input.type,
            accept_terms: input.accept_terms,
            ...(input.payment_method ? { payment_method: input.payment_method } : {}),
          },
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        });
        const message = res?.message?.trim?.() || "Subscription created successfully";
        return { status: "success", message, data: unwrapData<Subscription>(res) ?? null };
      } catch (error) {
        return mapPaymentConfirmationError(error, "Subscription requires payment confirmation");
      }
    },

    async swapPlan(input: SwapPlanInput): Promise<SubscriptionMutationResult> {
      try {
        const res = await client.request<any>(`${base}/subscription/swap`, {
          method: "POST",
          body: { target_plan: input.target_plan },
        });
        const message = res?.message?.trim?.() || "Plan changed successfully";
        return { status: "success", message, data: unwrapData<Subscription>(res) ?? null };
      } catch (error) {
        return mapPaymentConfirmationError(error, "Plan change requires payment confirmation");
      }
    },

    async cancelSubscription(input: CancelSubscriptionInput): Promise<void> {
      await client.request(`${base}/subscription/cancel`, {
        method: "POST",
        body: { comment: input.comment },
      });
    },

    async listInvoices(input = {}): Promise<InvoicePage> {
      const perPage = typeof input.per_page === "number" ? input.per_page : 10;
      const res = await client.request<any>(`${base}/payment/invoices`, {
        method: "GET",
        query: {
          per_page: perPage,
          ...(input.cursor ? { cursor: input.cursor } : {}),
          ...(input.team_id ? { team_id: input.team_id } : {}),
        },
      });
      const data = unwrapData<any>(res);
      const rawInvoices = Array.isArray(data?.invoices) ? data.invoices : Array.isArray(data) ? data : [];

      const items = rawInvoices.map((invoice: any) => ({
        id: String(invoice?.id ?? ""),
        number: typeof invoice?.number === "string" ? invoice.number : undefined,
        total: typeof invoice?.total === "string" ? invoice.total : undefined,
        status: String(invoice?.status ?? "open") as InvoicePage["items"][number]["status"],
        date: typeof invoice?.date === "string" ? invoice.date : "",
        invoice_pdf: typeof invoice?.invoice_pdf === "string" ? invoice.invoice_pdf : undefined,
        hosted_invoice_url: typeof invoice?.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : undefined,
        source: invoice?.source === "subscription" || invoice?.source === "purchase" ? invoice.source : undefined,
        type: typeof invoice?.type === "string" ? invoice.type : undefined,
      }));

      return {
        items,
        next_cursor: typeof data?.next_cursor === "string" ? data.next_cursor : null,
        previous_cursor: typeof data?.previous_cursor === "string" ? data.previous_cursor : null,
        has_more: Boolean(data?.has_more),
        per_page: Number(data?.per_page ?? perPage),
      };
    },

    async payInvoice(input: { invoice_id: string; team_id?: string }): Promise<InvoicePaymentResult> {
      const invoiceId = String(input.invoice_id ?? "").trim();
      if (!invoiceId) throw new Error("Invoice ID is required");

      const res = await client.request<any>(`${base}/payment/invoices/${encodeURIComponent(invoiceId)}/pay`, {
        method: "POST",
        body: { ...(input.team_id ? { team_id: input.team_id } : {}) },
      });

      const data = unwrapData<any>(res);

      return {
        outcome: (data?.outcome ?? "fallback_hosted_invoice") as InvoicePaymentResult["outcome"],
        invoice_id: String(data?.invoice_id ?? invoiceId),
        status: String(data?.status ?? "open"),
        hosted_invoice_url: typeof data?.hosted_invoice_url === "string" ? data.hosted_invoice_url : undefined,
      };
    },

    async purchase(input: PurchaseInput): Promise<PurchaseResult> {
      try {
        const res = await client.request<any>(`${base}/payment/purchase`, {
          method: "POST",
          body: {
            type: input.type,
            amount: input.amount,
            metadata: input.metadata,
            ...(input.team_id ? { team_id: input.team_id } : {}),
          },
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        });
        const data = unwrapData<any>(res);
        return {
          status: "success",
          message: typeof res?.message === "string" ? res.message : "Payment processed successfully",
          reference: String(data?.reference ?? ""),
          transaction_status: String(data?.status ?? "SUCCESSFUL") as PurchaseResult["transaction_status"],
          amount: Number(data?.amount ?? input.amount ?? 0),
          type: String(data?.type ?? input.type),
          metadata: data && typeof data?.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : {},
        };
      } catch (error) {
        if (!(error instanceof BackendApiError) || error.status !== 402) {
          throw error;
        }

        const payload = error.details as any;
        const data = unwrapData<any>(payload);

        return {
          status: "pending",
          message: error.message || "Payment requires confirmation",
          reference: String(data?.reference ?? ""),
          transaction_status: String(data?.status ?? "PENDING") as PurchaseResult["transaction_status"],
          amount: Number(data?.amount ?? input.amount ?? 0),
          type: String(data?.type ?? input.type),
          metadata: data && typeof data?.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : {},
          client_secret: typeof data?.client_secret === "string" ? data.client_secret : undefined,
        };
      }
    },

    async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
      const res = await client.request<any>(`${base}/verify-transaction`, {
        method: "GET",
        query: { reference },
        headers: serverApiKey ? { "X-API-Key": serverApiKey } : {},
      });
      const data = unwrapData<any>(res);
      return {
        reference: String(data?.reference ?? reference),
        status: String(data?.status ?? "PROCESSING") as VerifyTransactionResult["status"],
        amount: Number(data?.amount ?? 0),
        type: String(data?.type ?? ""),
        metadata: data && typeof data?.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : {},
      };
    },

    async updateSpendingLimit(input: UpdateSpendingLimitInput): Promise<void> {
      await client.request(`${base}/payment/spending-limit`, {
        method: "PUT",
        body: { spending_limit: input.spending_limit },
      });
    },

    async updateTeamSpendingLimit(input: UpdateTeamSpendingLimitInput): Promise<void> {
      await client.request(`${base}/payment/spending-limit/team/${encodeURIComponent(input.team_id)}`, {
        method: "PUT",
        body: { spending_limit: input.spending_limit },
      });
    },

    async updateTeamSubscription(input: UpdateTeamSubscriptionInput): Promise<void> {
      await client.request(`${base}/teams/${encodeURIComponent(input.team_id)}/subscription`, {
        method: "PUT",
        body: {
          ...(input.members !== undefined ? { members: input.members } : {}),
          ...(input.concurrent_builds !== undefined ? { concurrent_builds: input.concurrent_builds } : {}),
        },
      });
    },

    async getSubscriptionStats(teamId?: string): Promise<SubscriptionStats> {
      const res = await client.request<any>(`${base}/subscription/stats`, {
        method: "GET",
        query: teamId ? { team_id: teamId } : undefined,
      });
      const data = unwrapData<SubscriptionStats>(res);
      return {
        total: data?.total ?? "$0.00",
        raw_total: data?.raw_total,
        next_payment_date: data?.next_payment_date ?? null,
        usage_breakdown: data?.usage_breakdown,
        outstanding_invoice_count: data?.outstanding_invoice_count,
        outstanding_amount_due: data?.outstanding_amount_due,
        outstanding_invoices: data?.outstanding_invoices,
      };
    },

    async getSubscriptionSpecs(): Promise<any> {
      const res = await client.request<any>(`${base}/subscription-specifications`, {
        method: "GET",
      });
      return unwrapData<any>(res);
    },

    async getSpendingLimitStatus(teamId?: string): Promise<SpendingLimitStatus> {
      const res = await client.request<any>(`${base}/payment/spending-limit`, {
        method: "GET",
        query: teamId ? { team_id: teamId } : undefined,
      });
      const data = unwrapData<any>(res);
      return {
        spending_limit: Number(data?.spending_limit ?? 0),
        current_usage: Number(data?.current_usage ?? 0),
        plan_base_cost: Number(data?.plan_base_cost ?? 0),
        metered_usage: Number(data?.metered_usage ?? 0),
        usage_percentage: Number(data?.usage_percentage ?? 0),
        builds_disabled: Boolean(data?.builds_disabled),
        builds_disabled_by: String(data?.builds_disabled_by ?? "system"),
        has_subscription: Boolean(data?.has_subscription),
        stripe_alerts_active: Number(data?.stripe_alerts_active ?? 0),
      };
    },
  };
}
