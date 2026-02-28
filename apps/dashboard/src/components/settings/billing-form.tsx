import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import type { StripeCardElementOptions } from "@stripe/stripe-js";
import { motion } from "motion/react";
import { useTheme } from "@/hooks/use-theme";
import { usePricing } from "@/contexts/pricing-context";
import { PencilSimple } from "@phosphor-icons/react";
import { Theme } from "@/types/enums";
import { Plus, Star, X, CreditCard } from "lucide-react";
import { FolderTrashIcon } from "../shared/folder-trash-icon";
import { PaymentProvider } from "@/providers/payment-provider";
import { GlossyButton } from "../shared/glossy-button";
import { Spinner } from "../shared/spinner";
import { CursorPagination } from "../shared/pagination";
import { WarningModal } from "../shared/warning-modal";
import { ChangePlanModal } from "../shared/change-plan-modal";
import {
  usePaymentMethods,
  useSubscription,
  useBillEstimate,
  useInvoices,
  useCreateSetupIntent,
  useAddPaymentMethod,
  useRemovePaymentMethod,
  useSetDefaultPaymentMethod,
  useCancelSubscription,
  useUpdateSpendingLimit,
} from "@/hooks/use-payments";
import type { PaymentMethod } from "@/backend/payments";
import type { TeamDetails } from "@/backend/teams";
import type { DrawerUserProfile } from "@/utils/dashboard";

type UserProfile = DrawerUserProfile;
const settingsInputClass =
  "w-full input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]";

/* ── Wrapped billing form (provides Stripe Elements) ── */

export function BillingForm({
  profile,
  initialPaymentMethods,
  initialInvoices,
  initialSpendingStats,
  hidePaymentMethods = false,
  hideCurrentPlan = false,
  teamId,
  workspaceTeam,
  onSpendingLimitSaved,
}: {
  profile: UserProfile;
  initialPaymentMethods?: PaymentMethod[] | null;
  initialInvoices?: any;
  initialSpendingStats?: { used: number; spendingLimit: number } | null;
  hidePaymentMethods?: boolean;
  hideCurrentPlan?: boolean;
  teamId?: string;
  workspaceTeam?: TeamDetails | null;
  onSpendingLimitSaved?: () => void | Promise<void>;
}) {
  return (
    <PaymentProvider>
      <BillingFormInner
        profile={profile}
        initialPaymentMethods={initialPaymentMethods}
        initialInvoices={initialInvoices}
        initialSpendingStats={initialSpendingStats}
        hidePaymentMethods={hidePaymentMethods}
        hideCurrentPlan={hideCurrentPlan}
        teamId={teamId}
        workspaceTeam={workspaceTeam}
        onSpendingLimitSaved={onSpendingLimitSaved}
      />
    </PaymentProvider>
  );
}

/* ── Inner form (has access to hooks) ── */

function BillingFormInner({
  profile,
  initialPaymentMethods,
  initialInvoices,
  initialSpendingStats,
  hidePaymentMethods = false,
  hideCurrentPlan = false,
  teamId,
  workspaceTeam,
  onSpendingLimitSaved,
}: {
  profile: UserProfile;
  initialPaymentMethods?: PaymentMethod[] | null;
  initialInvoices?: any;
  initialSpendingStats?: { used: number; spendingLimit: number } | null;
  hidePaymentMethods?: boolean;
  hideCurrentPlan?: boolean;
  teamId?: string;
  workspaceTeam?: TeamDetails | null;
  onSpendingLimitSaved?: () => void | Promise<void>;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [replacePaymentMethodId, setReplacePaymentMethodId] = useState<string | null>(null);
  const [invoiceCursor, setInvoiceCursor] = useState<string | null>(null);
  const [invoicePage, setInvoicePage] = useState(1);
  const [spendingLimitInput, setSpendingLimitInput] = useState("");
  const [isEditingLimit, setIsEditingLimit] = useState(false);

  const { data: paymentMethods = [], isLoading: isLoadingMethods } = usePaymentMethods(initialPaymentMethods ?? undefined);
  const { data: subscription } = useSubscription();
  const { data: estimate } = useBillEstimate();
  const { data: invoices } = useInvoices(invoiceCursor, teamId, initialInvoices);
  const cancelMutation = useCancelSubscription();
  const spendingLimitMutation = useUpdateSpendingLimit(teamId);

  const daysSinceFailure = profile.subscriptionDue ? 1 : 0;

  let currentPlan = "Free";
  const normalizedPlanType = (
    subscription?.plan || profile.subscriptionPlanType || ""
  ).toLowerCase();

  if (normalizedPlanType.includes("developer")) {
    currentPlan = "Pro";
  } else if (normalizedPlanType.includes("hacker")) {
    currentPlan = "Hacker";
  } else if (normalizedPlanType.includes("team")) {
    currentPlan = "Team";
  }

  const pricing = usePricing();
  const activePlanPrice = pricing.plans.find((p) => p.name === currentPlan)?.amount ?? 0;
  const canChangePlan = currentPlan !== "Team";
  const hasActivePaidSubscription =
    currentPlan !== "Free" && subscription?.status !== "canceled";
  const isTeamMode = hideCurrentPlan || Boolean(teamId);
  const canEditSpendingLimit = isTeamMode
    ? Boolean(teamId) && workspaceTeam?.isCreator !== false
    : true;
  const initialLimit = isTeamMode
    ? (workspaceTeam?.spendingLimit ?? null)
    : (profile.spendingLimit ?? null);
  const [savedSpendingLimit, setSavedSpendingLimit] = useState<number | null>(
    initialLimit,
  );

  const defaultMethod = paymentMethods.find((m) => m.is_default) ?? paymentMethods[0];

  useEffect(() => {
    setSavedSpendingLimit(initialLimit);
  }, [initialLimit]);

  function normalizeCurrencyInput(raw: string) {
    return raw.replace(/[^\d.]/g, "");
  }

  function toCurrencyValue(raw: string) {
    const parsed = Number(normalizeCurrencyInput(raw));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  function handleSaveSpendingLimit() {
    const value = toCurrencyValue(spendingLimitInput);
    if (Number.isNaN(value)) {
      toast.error("Enter a valid amount");
      return;
    }

    if (value < 5) {
      toast.error("Spending limit must be at least $5");
      return;
    }

    spendingLimitMutation.mutate(value, {
      onSuccess: async () => {
        setSavedSpendingLimit(value);
        toast.success("Spending limit updated");
        setIsEditingLimit(false);
        setSpendingLimitInput("");
        await onSpendingLimitSaved?.();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to update spending limit");
      },
    });
  }

  const snapshotUsage = initialSpendingStats?.used;
  const currentUsage =
    typeof snapshotUsage === "number"
      ? snapshotUsage
      : Number(estimate?.projected_total ?? estimate?.current_usage ?? 0);
  const hasSpendingLimit =
    typeof savedSpendingLimit === "number" && savedSpendingLimit >= 5;

  return (
    <div className="flex max-w-[488px] flex-col gap-8">
      <PaymentFailureBanner daysSinceFailure={daysSinceFailure} />

      {/* ── Current plan ── */}
      {!hideCurrentPlan && (
        <div className="relative overflow-hidden rounded-[4px] bg-[#fcfcfc] dark:bg-[#121418]">
          <div className="px-6 py-3 pr-[116px]">
            <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-body dark:text-dash-text-faded">
              You are currently on the Brimble{" "}
              <span className="text-dash-text-strong dark:text-dash-text-strong">
                {currentPlan}
              </span>{" "}
              plan
              {activePlanPrice > 0 ? (
                <>
                  , you pay{" "}
                  <span className="text-dash-text-strong dark:text-dash-text-strong">
                    ${activePlanPrice}
                  </span>{" "}
                  per month.
                </>
              ) : (
                "."
              )}
            </p>
            {canChangePlan && (
              <button
                onClick={() => setChangePlanOpen(true)}
                className="mt-1.5 text-sm font-medium text-[#4879f8] underline underline-offset-2 hover:text-[#3a6ae6]"
              >
                Change plan
              </button>
            )}
          </div>
          <div className="absolute inset-y-0 right-0 hidden w-[96px] overflow-hidden sm:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,#ffffff_0%,#ececec_48%,#f7f7f7_100%)] dark:bg-[radial-gradient(circle_at_72%_28%,rgba(72,121,248,0.18)_0%,rgba(28,33,42,0.65)_45%,rgba(18,20,24,0.95)_100%)]" />
          </div>
        </div>
      )}

      {/* ── Usage / Bill estimate ── */}
      <UsageSection estimate={estimate} />

      {!hidePaymentMethods && (
        <>
          <hr className="-ml-8 border-dash-border-soft" />

          {/* ── Payment methods ── */}
          <div className="flex flex-col gap-[30px]">
            {paymentMethods.length === 0 && (
              <div className="flex items-center gap-[14px]">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dash-bg-elevated">
                  <CreditCard className="h-5 w-5 text-dash-text-faded" />
                </div>
                <div className="flex flex-col gap-[2px] py-2">
                  <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
                    Payment methods
                  </p>
                  <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
                    No payment methods added yet
                  </p>
                </div>
              </div>
            )}

            {isLoadingMethods && !showAddCard && (
              <div className="flex items-center gap-2">
                <Spinner size="size-4" className="text-dash-text-faded" />
                <span className="text-sm text-dash-text-faded">Loading payment methods...</span>
              </div>
            )}

            {!isLoadingMethods && paymentMethods.length > 0 && (
              <div className="flex flex-col gap-3">
                {paymentMethods.map((method) => (
                  <PaymentMethodRow
                    key={method.id}
                    method={method}
                    isDefault={method.id === defaultMethod?.id}
                    canRemove={!hasActivePaidSubscription}
                    onChangeCard={
                      method.id === defaultMethod?.id
                        ? () => {
                            setReplacePaymentMethodId(method.id);
                            setShowAddCard(true);
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            )}

            {paymentMethods.length === 0 && (
              !showAddCard ? (
                <button
                  type="button"
                  onClick={() => {
                    setReplacePaymentMethodId(null);
                    setShowAddCard(true);
                  }}
                  className="flex items-center gap-1.5 text-sm font-medium text-[#4879f8] hover:text-[#3a6ae6]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add payment method
                </button>
              ) : (
                <AddCardForm
                  replacePaymentMethodId={replacePaymentMethodId}
                  onClose={() => {
                    setShowAddCard(false);
                    setReplacePaymentMethodId(null);
                  }}
                />
              )
            )}

            {paymentMethods.length > 0 && showAddCard && (
              <AddCardForm
                replacePaymentMethodId={replacePaymentMethodId}
                onClose={() => {
                  setShowAddCard(false);
                  setReplacePaymentMethodId(null);
                }}
              />
            )}
          </div>

          <hr className="-ml-8 border-dash-border-soft" />
        </>
      )}

      {/* ── Spending limit ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-[2px]">
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
            Spending limit
          </p>
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
            Set a monthly spending cap to control costs
          </p>
        </div>
        {isEditingLimit ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-dash-text-faded">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={spendingLimitInput}
                onChange={(e) =>
                  setSpendingLimitInput(normalizeCurrencyInput(e.target.value))
                }
                className={`${settingsInputClass} h-[40px] w-[160px] pl-6 tabular-nums`}
                placeholder="0"
              />
            </div>
            <GlossyButton
              onClick={handleSaveSpendingLimit}
              disabled={spendingLimitMutation.isPending || spendingLimitInput.trim().length === 0}
              variant="black"
              className="h-[40px] rounded-[6px] px-4"
            >
              {spendingLimitMutation.isPending ? (
                <Spinner size="size-3.5" className="text-white" />
              ) : (
                "Save"
              )}
            </GlossyButton>
            <button
              onClick={() => {
                setSpendingLimitInput("");
                setIsEditingLimit(false);
              }}
              className="flex h-[40px] items-center rounded-[6px] border border-dash-border bg-dash-bg px-4 text-sm text-dash-text-body hover:bg-dash-bg-elevated"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm tabular-nums text-dash-text-body">
              {hasSpendingLimit
                ? `$${currentUsage.toFixed(2)} used / $${savedSpendingLimit.toFixed(2)} limit`
                : "No limit set"}
              {!hasSpendingLimit && estimate?.projected_total !== undefined && (
                <span className="text-dash-text-faded">
                  {" "}
                  / ${estimate.projected_total.toFixed(2)} projected
                </span>
              )}
            </p>
            {canEditSpendingLimit ? (
              <button
                onClick={() => {
                  setSpendingLimitInput(
                    typeof savedSpendingLimit === "number"
                      ? String(savedSpendingLimit)
                      : "5",
                  );
                  setIsEditingLimit(true);
                }}
                className="text-sm font-medium text-[#4879f8] hover:text-[#3a6ae6]"
              >
                {hasSpendingLimit ? "Edit" : "Set"}
              </button>
            ) : (
              <span className="text-xs text-dash-text-extra-faded">
                Only the workspace creator can update this limit
              </span>
            )}
          </div>
        )}
      </div>

      <hr className="-ml-8 border-dash-border-soft" />

      {/* ── Invoices ── */}
      <InvoicesSection
        invoices={invoices}
        page={invoicePage}
        onNextPage={() => {
          if (!invoices?.next_cursor) return;
          setInvoiceCursor(invoices.next_cursor);
          setInvoicePage((current) => current + 1);
        }}
        onPreviousPage={() => {
          if (!invoices?.previous_cursor) return;
          setInvoiceCursor(invoices.previous_cursor);
          setInvoicePage((current) => Math.max(1, current - 1));
        }}
      />

      <hr className="-ml-8 border-dash-border-soft" />

      {/* ── Cancel subscription ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-[2px] py-2">
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
            Manage your subscription
          </p>
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
            Cancel your current subscription
          </p>
        </div>
        <div>
          <GlossyButton variant="red" onClick={() => setCancelOpen(true)}>
            Cancel subscription
          </GlossyButton>
        </div>
      </div>

      <WarningModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel your subscription?"
        description={`Your plan will be cancelled at the end of the current billing period. You will be moved to the Free plan and lose access to ${currentPlan} features.`}
        confirmLabel="Cancel subscription"
        cancelLabel="Keep my plan"
        onConfirm={() => {
          cancelMutation.mutate(undefined, {
            onSuccess: () => {
              toast.success("Subscription cancelled. You'll keep access until the end of this billing period.");
              setCancelOpen(false);
            },
            onError: (err) => {
              toast.error(err instanceof Error ? err.message : "Failed to cancel subscription");
            },
          });
        }}
      />

      <ChangePlanModal
        open={changePlanOpen}
        onOpenChange={setChangePlanOpen}
        currentPlan={currentPlan}
        initialPaymentMethods={initialPaymentMethods}
      />
    </div>
  );
}

/* ── Payment failure banner ── */

function PaymentFailureBanner({
  daysSinceFailure,
}: {
  daysSinceFailure: number;
}) {
  if (daysSinceFailure <= 0) return null;

  const isBuildsDisabled = daysSinceFailure >= 7;
  const isDeactivated = daysSinceFailure >= 14;

  return (
    <div
      className={`rounded-[4px] border px-4 py-3 ${isDeactivated ? "border-[#ef2f1f]/30 bg-[#ef2f1f]/[0.06]" : "border-[#f5a623]/30 bg-[#f5a623]/[0.06]"}`}
    >
      <p
        className={`text-sm font-medium leading-5 ${isDeactivated ? "text-[#ef2f1f]" : "text-[#b37a10] dark:text-[#f5a623]"}`}
      >
        {isDeactivated
          ? "Your subscription has been deactivated. Update payment to reactivate."
          : isBuildsDisabled
            ? "Builds are disabled due to payment failure. Update your payment method to resume."
            : `Payment failed ${daysSinceFailure} day${daysSinceFailure === 1 ? "" : "s"} ago. Please update your payment method.`}
      </p>
    </div>
  );
}

/* ── Usage section (bill estimate) ── */

function UsageSection({
  estimate,
}: {
  estimate?: { current_usage: number; projected_total: number; line_items: Array<{ description: string; amount: number }> } | null;
}) {
  const used = Number(estimate?.current_usage ?? 0);
  const projected = Number(estimate?.projected_total ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-[2px]">
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
            Current usage
          </p>
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
            Billing usage for the current period
          </p>
        </div>

        {projected > 0 ? (
          <UsageBar
            label="Spending budget"
            used={used}
            limit={projected}
            unit="USD"
            overageNote="Overage may be added to the next invoice"
          />
        ) : (
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
            No spending budget configured yet.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Usage bar ── */

function UsageBar({
  label,
  used,
  limit,
  unit,
  overageNote,
}: {
  label: string;
  used: number;
  limit: number;
  unit: string;
  overageNote?: string;
}) {
  const overage = Math.max(0, used - limit);
  const pct = Math.min(100, (used / limit) * 100);
  const isOver = used > limit;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-dash-text-body">{label}</span>
        <span className="text-sm tabular-nums text-dash-text-faded">
          {used.toLocaleString()} / {limit.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-dash-bg-elevated">
        <div
          className={`h-full rounded-full transition-all ${isOver ? "bg-[#f5a623]" : "bg-[#4879f8]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {overage > 0 && overageNote && (
        <p className="text-xs text-[#f5a623]">
          {overage.toLocaleString()} {unit} overage — {overageNote}
        </p>
      )}
    </div>
  );
}

/* ── Card chip visual (matches add-domain-modal / domains/buy) ── */

function CardChip() {
  return (
    <div className="relative h-8 w-[45px] shrink-0 overflow-hidden rounded-[4px] bg-[radial-gradient(circle_at_84%_10%,#5a5454_0%,#383636_55%,#1f1f1f_100%)] shadow-[0px_1px_1px_rgba(0,0,0,0.16),0px_1px_0px_rgba(0,0,0,0.11)]">
      <div className="absolute left-[5px] top-[12px] h-[7px] w-[10px] rounded-[1.5px] bg-white/10" />
      <div className="absolute bottom-[5px] right-[5px] flex items-center gap-0.5">
        <span className="size-[3px] rounded-full bg-[#ea4335]" />
        <span className="size-[3px] rounded-full bg-[#fbbc05]" />
      </div>
    </div>
  );
}

function formatCardType(cardType?: string): string {
  if (!cardType) return "Card";
  const lower = cardType.toLowerCase();
  if (lower === "visa") return "Visa";
  if (lower === "mastercard" || lower === "mc") return "Mastercard";
  if (lower === "amex" || lower === "american_express") return "Amex";
  if (lower === "discover") return "Discover";
  return cardType.charAt(0).toUpperCase() + cardType.slice(1);
}

/* ── Payment method row ── */

function PaymentMethodRow({
  method,
  isDefault,
  canRemove,
  onChangeCard,
}: {
  method: Record<string, any>;
  isDefault: boolean;
  canRemove: boolean;
  onChangeCard?: () => void;
}) {
  const removeMutation = useRemovePaymentMethod();
  const setDefaultMutation = useSetDefaultPaymentMethod();

  // Card data may be nested under `.card` or flat on the method object
  const card = method.card ?? method;
  const brand = formatCardType(card?.brand ?? method.type ?? "card");
  const last4 = card?.last4 ?? "••••";
  const expMonth = card?.exp_month != null ? String(card.exp_month).padStart(2, "0") : "--";
  const expYear = card?.exp_year != null ? String(card.exp_year) : "----";

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-[14px]">
        <CardChip />
        <div className="flex flex-col gap-[2px]">
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
            {brand} •••• {last4}
          </p>
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
            Expires {expMonth}/{expYear}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {isDefault && onChangeCard && (
          <button
            type="button"
            onClick={onChangeCard}
            className="rounded-[4px] p-1.5 text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-body"
            title="Change card"
          >
            <PencilSimple className="h-3.5 w-3.5" weight="regular" />
          </button>
        )}
        {!isDefault && (
          <button
            type="button"
            disabled={setDefaultMutation.isPending}
            onClick={() =>
              setDefaultMutation.mutate(method.id, {
                onSuccess: () => toast.success("Default payment method updated"),
                onError: (err) =>
                  toast.error(err instanceof Error ? err.message : "Failed to set default"),
              })
            }
            className="rounded-[4px] p-1.5 text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-body"
            title="Set as default"
          >
            <Star className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          disabled={removeMutation.isPending}
          onClick={() =>
            canRemove
              ? removeMutation.mutate(method.id, {
                  onSuccess: () => toast.success("Payment method removed"),
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Failed to remove payment method"),
                })
              : toast.error("You can't remove your payment method while subscribed to a paid plan")
          }
          className={`rounded-[4px] p-1.5 text-dash-text-faded transition-colors ${
            canRemove
              ? "hover:bg-[#ef2f1f]/10 hover:text-[#ef2f1f]"
              : "opacity-40"
          } disabled:pointer-events-none disabled:opacity-40`}
          title={
            canRemove
              ? "Remove"
              : "Active subscriptions require a payment method on file"
          }
        >
          {removeMutation.isPending ? (
            <Spinner className="size-3.5" />
          ) : (
            <FolderTrashIcon className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Add card form (inline Stripe CardElement) ── */

function AddCardForm({
  onClose,
  replacePaymentMethodId,
}: {
  onClose: () => void;
  replacePaymentMethodId?: string | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const setupIntentMutation = useCreateSetupIntent();
  const addMethodMutation = useAddPaymentMethod();
  const removeMethodMutation = useRemovePaymentMethod();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardError, setCardError] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === Theme.Dark;

  const cardOptions: StripeCardElementOptions = useMemo(
    () => ({
      style: {
        base: {
          fontSize: "14px",
          lineHeight: "24px",
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          color: isDark ? "#e8eaed" : "#222528",
          backgroundColor: "transparent",
          "::placeholder": { color: isDark ? "#6b7280" : "#9ca3af" },
          iconColor: isDark ? "#9ca3af" : "#6b7280",
        },
        invalid: {
          color: "#ef2f1f",
          iconColor: "#ef2f1f",
        },
      },
    }),
    [isDark],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) {
      toast.error("Stripe is not loaded yet");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      toast.error("Card element not found");
      return;
    }

    setIsSubmitting(true);

    try {
      const { client_secret } = await setupIntentMutation.mutateAsync();

      if (!client_secret) {
        throw new Error("Failed to create setup intent");
      }

      const result = await stripe.confirmCardSetup(client_secret, {
        payment_method: { card: cardElement },
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Card setup failed");
      }

      const paymentMethodId = result.setupIntent?.payment_method;
      if (!paymentMethodId || typeof paymentMethodId !== "string") {
        throw new Error("No payment method returned");
      }

      await addMethodMutation.mutateAsync(paymentMethodId);

      if (
        replacePaymentMethodId &&
        replacePaymentMethodId !== paymentMethodId
      ) {
        try {
          await removeMethodMutation.mutateAsync(replacePaymentMethodId);
        } catch (removeError) {
          toast.error(
            removeError instanceof Error
              ? removeError.message
              : "New card added, but the old card could not be removed",
          );
        }
      }

      toast.success(
        replacePaymentMethodId
          ? "Payment method updated successfully"
          : "Payment method added successfully",
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add payment method");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-px pb-px">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-dash-text-strong">
            {replacePaymentMethodId ? "Change card" : "Add a new card"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-1 text-dash-text-faded hover:text-dash-text-body"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={`input-base flex h-[50px] items-center overflow-hidden px-3 [&_.StripeElement]:w-full ${cardError ? "!shadow-[0_0_0_1px_#ef2f1f,0_0_0_3px_rgba(239,47,31,0.15)]" : "input-focus-within"}`}>
          <CardElement
            options={cardOptions}
            onChange={(e) => setCardError(!!e.error)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting || !stripe || cardError}
            className="flex h-[34px] items-center rounded-[4px] border border-[#232931] bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32] px-4 text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner size="size-3.5" className="text-white" />
                Adding...
              </span>
            ) : (
              "Add card"
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[34px] items-center rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}

/* ── Invoices section ── */

function InvoicesSection({
  invoices,
  page,
  onNextPage,
  onPreviousPage,
}: {
  invoices?: {
    items: Array<{
      id: string;
      number?: string;
      total?: string;
      status: string;
      invoice_pdf?: string;
      date: string;
    }>;
    next_cursor: string | null;
    previous_cursor: string | null;
    has_more: boolean;
  } | null;
  page: number;
  onNextPage: () => void;
  onPreviousPage: () => void;
}) {
  const items = invoices?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-[2px] py-2">
        <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
          Payment history and invoices
        </p>
        <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
          See your billing history with Brimble including invoices
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {items.map((invoice) => {
          let label = "Unknown date";
          if (invoice.date) {
            const parsed = new Date(invoice.date);
            if (!Number.isNaN(parsed.getTime())) {
              label = new Intl.DateTimeFormat("en-US", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(parsed);
            }
          }

          return (
            <div
              key={invoice.id}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">
                  {invoice.number || "Invoice"}
                </p>
                <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
                  {label}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-dash-text-extra-faded">
                  {invoice.status} {invoice.total ? `• ${invoice.total}` : ""}
                </span>
                {invoice.invoice_pdf ? (
                  <a
                    href={invoice.invoice_pdf}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[8px] border border-dash-border bg-dash-bg px-3 py-1.5 text-sm leading-5 tracking-[-0.0224px] text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
                  >
                    Download
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
            No invoices yet.
          </p>
        )}
      </div>
      {(invoices?.next_cursor || invoices?.previous_cursor) && (
        <div className="flex justify-end pt-1">
          <CursorPagination
            hasNextPage={Boolean(invoices?.next_cursor)}
            hasPrevPage={Boolean(invoices?.previous_cursor)}
            onNext={onNextPage}
            onPrev={onPreviousPage}
            label={`Page ${page}`}
          />
        </div>
      )}
    </div>
  );
}
