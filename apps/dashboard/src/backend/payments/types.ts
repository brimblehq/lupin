/* ── Payment method ── */

export interface PaymentMethodCard {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

export interface PaymentMethod {
  id: string;
  type: string;
  card?: PaymentMethodCard;
  is_default: boolean;
  created_at: string;
}

/* ── Subscription ── */

export interface Subscription {
  id: string;
  plan: string;
  status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  payment_method?: string;
}

/* ── Invoices ── */

export interface Invoice {
  id: string;
  number?: string;
  total?: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  date: string;
  invoice_pdf?: string;
  source?: "subscription" | "purchase";
  type?: string;
}

export interface InvoicePage {
  items: Invoice[];
  next_cursor: string | null;
  previous_cursor: string | null;
  has_more: boolean;
  per_page: number;
}

/* ── Bill estimate ── */

export interface BillEstimateLineItem {
  description: string;
  amount: number;
  quantity?: number;
}

export interface BillEstimate {
  current_usage: number;
  projected_total: number;
  line_items: BillEstimateLineItem[];
  next_billing_date: string;
}

/* ── Setup intent ── */

export interface SetupIntentResult {
  client_secret: string;
}

/* ── Mutation inputs ── */

export interface AddPaymentMethodInput {
  payment_method: string;
}

export interface CreateSubscriptionInput {
  type: string;
  payment_method?: string;
  accept_terms: boolean;
}

export interface SwapPlanInput {
  target_plan: string;
}

export type PurchaseType =
  | "PURCHASE_DOMAIN"
  | "RENEW_DOMAIN"
  | "SERVICE_PURCHASE"
  | "LLM_TOKENS"
  | "BUILD_MINUTES";

export interface PurchaseInput {
  type: PurchaseType;
  amount: number;
  metadata: Record<string, unknown>;
  team_id?: string;
}

export interface UpdateSpendingLimitInput {
  spending_limit: number;
}

export interface UpdateTeamSpendingLimitInput {
  team_id: string;
  spending_limit: number;
}

export interface UpdateTeamSubscriptionInput {
  team_id: string;
  members?: number;
  concurrent_builds?: number;
}

/* ── Purchase result (SCA handling) ── */

export interface PurchaseResult {
  status: "success" | "pending";
  message: string;
  reference: string;
  transaction_status: "PROCESSING" | "SUCCESSFUL" | "PENDING" | "FAILED";
  amount: number;
  type: string;
  metadata: Record<string, unknown>;
  client_secret?: string;
}

export interface VerifyTransactionResult {
  reference: string;
  status: "PROCESSING" | "SUCCESSFUL" | "PENDING" | "FAILED" | "REFUNDED";
  amount: number;
  type: string;
  metadata: Record<string, unknown>;
}

/* ── API interface ── */

export interface PaymentsApi {
  listPaymentMethods(): Promise<PaymentMethod[]>;
  createSetupIntent(): Promise<SetupIntentResult>;
  addPaymentMethod(input: AddPaymentMethodInput): Promise<PaymentMethod>;
  removePaymentMethod(id: string): Promise<void>;
  setDefaultPaymentMethod(id: string): Promise<void>;
  getSubscription(): Promise<Subscription | null>;
  createSubscription(input: CreateSubscriptionInput): Promise<Subscription>;
  swapPlan(input: SwapPlanInput): Promise<Subscription>;
  cancelSubscription(): Promise<void>;
  getBillEstimate(): Promise<BillEstimate>;
  listInvoices(input?: {
    cursor?: string | null;
    per_page?: number;
    team_id?: string;
  }): Promise<InvoicePage>;
  purchase(input: PurchaseInput): Promise<PurchaseResult>;
  verifyTransaction(reference: string): Promise<VerifyTransactionResult>;
  updateSpendingLimit(input: UpdateSpendingLimitInput): Promise<void>;
  updateTeamSpendingLimit(input: UpdateTeamSpendingLimitInput): Promise<void>;
  updateTeamSubscription(input: UpdateTeamSubscriptionInput): Promise<void>;
  getSubscriptionSpecs(): Promise<any>;
}
