import config from "@/config";
import type { ApiClient } from "./types";
import type {
  PaymentsApi,
  PaymentMethod,
  SetupIntentResult,
  AddPaymentMethodInput,
  Subscription,
  CreateSubscriptionInput,
  SwapPlanInput,
  BillEstimate,
  InvoicePage,
  PurchaseInput,
  PurchaseResult,
  UpdateSpendingLimitInput,
  UpdateTeamSubscriptionInput,
} from "./payments/types";

export type { PaymentsApi } from "./payments/types";
export type {
  PaymentMethod,
  PaymentMethodCard,
  SetupIntentResult,
  AddPaymentMethodInput,
  Subscription,
  CreateSubscriptionInput,
  SwapPlanInput,
  BillEstimate,
  BillEstimateLineItem,
  Invoice,
  InvoicePage,
  PurchaseInput,
  PurchaseResult,
  UpdateSpendingLimitInput,
  UpdateTeamSubscriptionInput,
} from "./payments/types";

function unwrapData<T = any>(payload: any): T {
  if (payload?.data?.data !== undefined) return payload.data.data as T;
  if (payload?.data !== undefined) return payload.data as T;
  return payload as T;
}

function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createPaymentsApi(client: ApiClient): PaymentsApi {
  const base = config.paymentApiUrl;

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

    async addPaymentMethod(input: AddPaymentMethodInput): Promise<PaymentMethod> {
      const res = await client.request<any>(`${base}/payment/payment-method`, {
        method: "POST",
        body: { payment_method: input.payment_method },
      });
      return unwrapData<PaymentMethod>(res);
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
        const res = await client.request<any>(`${base}/subscriptions/current`, {
          method: "GET",
        });
        const data = unwrapData<any>(res);
        if (!data || !data.id) return null;
        return data as Subscription;
      } catch {
        return null;
      }
    },

    async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
      const res = await client.request<any>(`${base}/subscription/create`, {
        method: "POST",
        body: {
          type: input.type,
          accept_terms: input.accept_terms,
          ...(input.payment_method ? { payment_method: input.payment_method } : {}),
        },
        headers: { "Idempotency-Key": generateIdempotencyKey() },
      });
      return unwrapData<Subscription>(res);
    },

    async swapPlan(input: SwapPlanInput): Promise<Subscription> {
      const res = await client.request<any>(`${base}/subscription/swap`, {
        method: "POST",
        body: { target_plan: input.target_plan },
      });
      return unwrapData<Subscription>(res);
    },

    async cancelSubscription(): Promise<void> {
      await client.request(`${base}/subscriptions/cancel`, {
        method: "POST",
      });
    },

    async getBillEstimate(): Promise<BillEstimate> {
      const res = await client.request<any>(`${base}/billing/estimate`, {
        method: "GET",
      });
      return unwrapData<BillEstimate>(res);
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
      const rawInvoices = Array.isArray(data?.invoices)
        ? data.invoices
        : Array.isArray(data)
          ? data
          : [];

      const items = rawInvoices.map((invoice: any) => ({
        id: String(invoice?.id ?? ""),
        number:
          typeof invoice?.number === "string" ? invoice.number : undefined,
        total: typeof invoice?.total === "string" ? invoice.total : undefined,
        status: String(invoice?.status ?? "open") as InvoicePage["items"][number]["status"],
        date: typeof invoice?.date === "string" ? invoice.date : "",
        invoice_pdf:
          typeof invoice?.invoice_pdf === "string"
            ? invoice.invoice_pdf
            : undefined,
      }));

      return {
        items,
        next_cursor:
          typeof data?.next_cursor === "string" ? data.next_cursor : null,
        previous_cursor:
          typeof data?.previous_cursor === "string"
            ? data.previous_cursor
            : null,
        has_more: Boolean(data?.has_more),
        per_page: Number(data?.per_page ?? perPage),
      };
    },

    async purchase(input: PurchaseInput): Promise<PurchaseResult> {
      const res = await client.request<any>(`${base}/purchases`, {
        method: "POST",
        body: {
          items: input.items,
          payment_method_id: input.payment_method_id,
        },
        headers: { "Idempotency-Key": generateIdempotencyKey() },
      });
      const data = unwrapData<any>(res);
      return {
        success: Boolean(data?.success),
        requires_action: data?.requires_action,
        payment_intent_client_secret: data?.payment_intent_client_secret,
      };
    },

    async updateSpendingLimit(input: UpdateSpendingLimitInput): Promise<void> {
      await client.request(`${base}/spending-limit`, {
        method: "PUT",
        body: { monthly_limit: input.monthly_limit },
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

    async getSubscriptionSpecs(): Promise<any> {
      const res = await client.request<any>(`${base}/subscription-specifications`, {
        method: "GET",
      });
      return unwrapData<any>(res);
    },
  };
}
