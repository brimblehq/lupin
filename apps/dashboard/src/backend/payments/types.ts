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
  hosted_invoice_url?: string;
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

export interface InvoicePaymentResult {
  outcome: "paid" | "fallback_hosted_invoice" | "already_settled";
  invoice_id: string;
  status: string;
  hosted_invoice_url?: string;
}

/* ── Subscription stats (forecasted bill) ── */

export interface UsageBreakdownResource {
  amount: number;
  quantity: number;
}

export interface UsageBreakdown {
  cpu: UsageBreakdownResource;
  memory: UsageBreakdownResource;
  storage: UsageBreakdownResource;
  bandwidth: UsageBreakdownResource;
  compute: UsageBreakdownResource;
  metered_total: number;
}

export interface SubscriptionStats {
  total: string;
  raw_total?: number;
  next_payment_date: string | null;
  usage_breakdown?: UsageBreakdown;
  outstanding_invoice_count?: number;
  outstanding_amount_due?: number;
  outstanding_invoices?: unknown[];
}

/* ── Spending limit status ── */

export interface SpendingLimitStatus {
  spending_limit: number;
  current_usage: number;
  plan_base_cost: number;
  metered_usage: number;
  usage_percentage: number;
  builds_disabled: boolean;
  builds_disabled_by: string;
  has_subscription: boolean;
  stripe_alerts_active: number;
}

/* ── Setup intent ── */

export interface SetupIntentResult {
  client_secret: string;
}

export interface AddPaymentMethodPendingData {
  requires_action: boolean;
  setup_intent_id: string;
  client_secret: string;
  redirect_url: string;
}

export interface AddPaymentMethodSuccessResult {
  status: "success";
  message: string;
  data: null;
}

export interface AddPaymentMethodPendingResult {
  status: "pending";
  message: string;
  data: AddPaymentMethodPendingData;
}

export type AddPaymentMethodResult = AddPaymentMethodSuccessResult | AddPaymentMethodPendingResult;

/* ── Subscription mutation result (SCA handling) ── */

export interface SubscriptionPaymentPendingData {
  requires_action: boolean;
  payment_intent_id: string;
  client_secret: string | null;
}

export interface SubscriptionMutationSuccessResult {
  status: "success";
  message: string;
  data: Subscription | null;
}

export interface SubscriptionMutationPendingResult {
  status: "pending";
  message: string;
  data: SubscriptionPaymentPendingData;
}

export type SubscriptionMutationResult = SubscriptionMutationSuccessResult | SubscriptionMutationPendingResult;

/* ── Mutation inputs ── */

export interface AddPaymentMethodInput {
  payment_method: string;
  return_url: string;
}

export interface CreateSubscriptionInput {
  type: string;
  payment_method?: string;
  accept_terms: boolean;
}

export interface SwapPlanInput {
  target_plan: string;
}

export interface CancelSubscriptionInput {
  comment: string;
}

export type PurchaseType = "PURCHASE_DOMAIN" | "RENEW_DOMAIN" | "SERVICE_PURCHASE" | "LLM_TOKENS" | "BUILD_MINUTES";

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
  addPaymentMethod(input: AddPaymentMethodInput): Promise<AddPaymentMethodResult>;
  confirmPaymentMethod(setupIntentId: string): Promise<void>;
  removePaymentMethod(id: string): Promise<void>;
  setDefaultPaymentMethod(id: string): Promise<void>;
  getSubscription(): Promise<Subscription | null>;
  createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionMutationResult>;
  swapPlan(input: SwapPlanInput): Promise<SubscriptionMutationResult>;
  cancelSubscription(input: CancelSubscriptionInput): Promise<void>;
  listInvoices(input?: { cursor?: string | null; per_page?: number; team_id?: string }): Promise<InvoicePage>;
  payInvoice(input: { invoice_id: string; team_id?: string }): Promise<InvoicePaymentResult>;
  purchase(input: PurchaseInput): Promise<PurchaseResult>;
  verifyTransaction(reference: string): Promise<VerifyTransactionResult>;
  updateSpendingLimit(input: UpdateSpendingLimitInput): Promise<void>;
  updateTeamSpendingLimit(input: UpdateTeamSpendingLimitInput): Promise<void>;
  updateTeamSubscription(input: UpdateTeamSubscriptionInput): Promise<void>;
  getSubscriptionStats(teamId?: string): Promise<SubscriptionStats>;
  getSubscriptionSpecs(): Promise<any>;
  getSpendingLimitStatus(teamId?: string): Promise<SpendingLimitStatus>;
}
