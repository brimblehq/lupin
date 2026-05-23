import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import type { StripeCardElementOptions } from "@stripe/stripe-js";
import { motion } from "motion/react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@brimble/ui";
import { getUserOverviewServerFn } from "@/server/overview/actions";
import type { UserOverview } from "@/backend/user-overview";
import { usePricing } from "@/contexts/pricing-context";
import { ArrowSquareOut, CreditCard, PencilSimple } from "@phosphor-icons/react";
import { Check, ChevronDown, Copy, Plus, Star, X } from "lucide-react";
import { FolderTrashIcon } from "../shared/folder-trash-icon";
import { PaymentProvider } from "@/providers/payment-provider";
import { GlossyButton } from "../shared/glossy-button";
import { Spinner } from "../shared/spinner";
import { CursorPagination } from "../shared/pagination";
import { WarningModal } from "../shared/warning-modal";
import { CancelSubscriptionModal } from "./cancel-subscription-modal";
import { ChangePlanModal } from "../shared/change-plan-modal";
import { SimpleTooltip } from "../shared/tooltip";
import { dashInputClassName } from "../shared/dash-input";
import { BuildMinutesCard } from "./build-minutes-card";
import {
  usePaymentMethods,
  useSubscription,
  useSubscriptionStats,
  useInvoices,
  useAddPaymentMethod,
  useConfirmPaymentMethod,
  useRemovePaymentMethod,
  useSetDefaultPaymentMethod,
  usePayInvoice,
  useUpdateSpendingLimit,
  useSpendingLimitStatus,
} from "@/hooks/use-payments";
import type { PaymentMethod, SubscriptionStats, UsageBreakdown as UsageBreakdownData } from "@/backend/payments";
import type { TeamDetails } from "@/backend/teams";
import type { DrawerUserProfile } from "@/utils/dashboard";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

type UserProfile = DrawerUserProfile;
const settingsInputClass = dashInputClassName;

/* ── Wrapped billing form (provides Stripe Elements) ── */

export function BillingForm({
  profile,
  initialPaymentMethods,
  initialInvoices,
  initialSubscriptionStats,
  initialUserOverview,
  hidePaymentMethods = false,
  hideCurrentPlan = false,
  teamId,
  workspaceTeam,
  onSpendingLimitSaved,
}: {
  profile: UserProfile;
  initialPaymentMethods?: PaymentMethod[] | null;
  initialInvoices?: any;
  initialSubscriptionStats?: SubscriptionStats | null;
  initialUserOverview?: UserOverview | null;
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
        initialSubscriptionStats={initialSubscriptionStats}
        initialUserOverview={initialUserOverview}
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
  initialSubscriptionStats,
  initialUserOverview,
  hidePaymentMethods = false,
  hideCurrentPlan = false,
  teamId,
  workspaceTeam,
  onSpendingLimitSaved,
}: {
  profile: UserProfile;
  initialPaymentMethods?: PaymentMethod[] | null;
  initialInvoices?: any;
  initialSubscriptionStats?: SubscriptionStats | null;
  initialUserOverview?: UserOverview | null;
  hidePaymentMethods?: boolean;
  hideCurrentPlan?: boolean;
  teamId?: string;
  workspaceTeam?: TeamDetails | null;
  onSpendingLimitSaved?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [replacePaymentMethodId, setReplacePaymentMethodId] = useState<string | null>(null);
  const [invoiceCursor, setInvoiceCursor] = useState<string | null>(null);
  const [invoicePage, setInvoicePage] = useState(1);
  const [spendingLimitInput, setSpendingLimitInput] = useState("");
  const [isEditingLimit, setIsEditingLimit] = useState(false);

  const { data: paymentMethods = [], isLoading: isLoadingMethods } = usePaymentMethods(initialPaymentMethods ?? undefined);
  const canUseInitialUserOverview = useMemo(() => {
    if (!initialUserOverview) {
      return false;
    }

    if (teamId) {
      return initialUserOverview.buildMinutes.ownerType === "team" && initialUserOverview.buildMinutes.ownerId === teamId;
    }

    return initialUserOverview.buildMinutes.ownerType !== "team";
  }, [initialUserOverview, teamId]);

  const { data: userOverview } = useQuery<UserOverview>({
    queryKey: ["user-overview", teamId ?? "self"],
    queryFn: () =>
      (getUserOverviewServerFn as unknown as (args: { data: { teamId?: string } }) => Promise<UserOverview>)({ data: { teamId } }),
    ...(canUseInitialUserOverview && initialUserOverview ? { initialData: initialUserOverview } : {}),
  });
  const { data: subscription } = useSubscription();
  const { data: subscriptionStats } = useSubscriptionStats(teamId, initialSubscriptionStats ?? undefined);
  const effectiveSubscriptionStats = subscriptionStats ?? initialSubscriptionStats ?? null;
  const usageBreakdown = effectiveSubscriptionStats?.usage_breakdown;
  const { data: spendingLimitStatus } = useSpendingLimitStatus(teamId);
  const { data: invoices } = useInvoices(invoiceCursor, teamId, initialInvoices);
  const payInvoiceMutation = usePayInvoice();
  const spendingLimitMutation = useUpdateSpendingLimit(teamId);
  const isTeamMode = hideCurrentPlan || Boolean(teamId);

  const daysSinceFailure = profile.subscriptionDue ? 1 : 0;

  let currentPlan = "Free";
  const normalizedPlanType = (profile.subscriptionPlanType || subscription?.plan || "").toLowerCase();

  if (normalizedPlanType.includes("developer")) {
    currentPlan = "Pro";
  } else if (normalizedPlanType.includes("hacker")) {
    currentPlan = "Hacker";
  } else if (normalizedPlanType.includes("team")) {
    currentPlan = "Team";
  }

  const pricing = usePricing();
  const activePlanPrice = pricing.plans.find((p) => p.name === currentPlan)?.amount ?? 0;
  const canChangePlan = !isTeamMode && currentPlan !== "Team";
  const normalizedSubscriptionStatus = String(subscription?.status ?? "")
    .trim()
    .toLowerCase();
  const normalizedTeamSubscriptionType = String(workspaceTeam?.subscriptionType ?? "")
    .trim()
    .toLowerCase();
  const normalizedTeamSubscriptionStatus = String(workspaceTeam?.subscriptionStatus ?? "")
    .trim()
    .toLowerCase();
  const hasActivePaidSubscription = isTeamMode
    ? Boolean(teamId) &&
      normalizedTeamSubscriptionType.length > 0 &&
      normalizedTeamSubscriptionType !== "default" &&
      normalizedTeamSubscriptionStatus !== "canceled" &&
      normalizedTeamSubscriptionStatus !== "cancelled" &&
      normalizedTeamSubscriptionStatus !== "incomplete_expired"
    : currentPlan !== "Free" && normalizedSubscriptionStatus !== "canceled" && normalizedSubscriptionStatus !== "cancelled";
  const canEditSpendingLimit = isTeamMode ? Boolean(teamId) && workspaceTeam?.isCreator !== false : true;
  const initialLimit = isTeamMode ? (workspaceTeam?.spendingLimit ?? null) : (profile.spendingLimit ?? null);
  const [savedSpendingLimit, setSavedSpendingLimit] = useState<number | null>(initialLimit);

  const defaultMethod = paymentMethods.find((m) => m.is_default) ?? paymentMethods[0];

  useEffect(() => {
    setSavedSpendingLimit(spendingLimitStatus?.spending_limit ?? initialLimit);
  }, [initialLimit, spendingLimitStatus?.spending_limit]);

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
        invalidateActiveMatches(router);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to update spending limit");
      },
    });
  }

  const currentUsage = spendingLimitStatus?.current_usage ?? 0;
  const hasSpendingLimit = typeof savedSpendingLimit === "number" && savedSpendingLimit >= 5;
  const payingInvoiceId = payInvoiceMutation.isPending
    ? ((payInvoiceMutation.variables as { invoice_id?: string } | undefined)?.invoice_id ?? null)
    : null;

  function handlePayInvoice(invoice: { id: string; hosted_invoice_url?: string }) {
    payInvoiceMutation.mutate(
      {
        invoice_id: invoice.id,
        ...(teamId ? { team_id: teamId } : {}),
      },
      {
        onSuccess: (result) => {
          const outcome = String(result?.outcome ?? "");
          const status = String(result?.status ?? "").toLowerCase();

          if (outcome === "paid" || status === "paid") {
            toast.success("Invoice paid successfully");
            invalidateActiveMatches(router);
            return;
          }

          const hostedInvoiceUrl = result?.hosted_invoice_url ?? invoice.hosted_invoice_url;
          if (hostedInvoiceUrl) {
            window.open(hostedInvoiceUrl, "_blank", "noopener,noreferrer");
            toast.success("Opening Stripe to complete invoice payment");
            return;
          }

          toast.error("Unable to pay invoice right now");
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to pay invoice");
        },
      },
    );
  }

  return (
    <div className="flex max-w-[488px] flex-col gap-8">
      {canChangePlan && (
        <>
          {/* ── Change plan ── */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-[2px] py-2">
              <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Plan</p>
              <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">You're currently on the {currentPlan} plan.</p>
            </div>
            <div>
              <GlossyButton variant="blue" onClick={() => setChangePlanOpen(true)}>
                {currentPlan === "Free" ? "Upgrade plan" : "Change plan"}
              </GlossyButton>
            </div>
          </div>

          <hr className="-ml-8 border-dash-border-soft" />
        </>
      )}

      <PaymentFailureBanner daysSinceFailure={daysSinceFailure} />

      {/* ── Forecasted bill ── */}
      <BillForecast stats={effectiveSubscriptionStats} hasOpenInvoice={invoices?.items?.some((inv) => inv.status === "open") ?? false} />

      {/* ── Usage / Bill estimate ── */}
      <UsageSection spendingLimit={savedSpendingLimit} usage={currentUsage} />

      {/* ── Build minutes ── */}
      <BuildMinutesCard
        usedMinutes={userOverview?.buildMinutes.used ?? 0}
        includedMinutes={userOverview?.buildMinutes.included ?? 0}
        creditMinutes={userOverview?.buildMinutes.purchased ?? 0}
        resetDate={userOverview?.buildMinutes.nextResetAt ?? (teamId ? null : (effectiveSubscriptionStats?.next_payment_date ?? null))}
        teamId={teamId}
        initialPaymentMethods={initialPaymentMethods}
      />

      {/* ── Usage breakdown (per-resource) ── */}
      {usageBreakdown && <UsageBreakdown breakdown={usageBreakdown} planName={currentPlan} planAmount={activePlanPrice} />}

      {!hidePaymentMethods && (
        <>
          <hr className="-ml-8 border-dash-border-soft" />

          {/* ── Payment methods ── */}
          <div className="flex flex-col gap-[30px]">
            {paymentMethods.length === 0 && (
              <div className="flex items-center gap-[14px]">
                <div className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-dash-bg-elevated">
                  <CreditCard size={20} className="text-dash-text-faded" />
                </div>
                <div className="flex flex-col gap-[2px] py-2">
                  <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Payment methods</p>
                  <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">No payment methods added yet</p>
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
                    requiresRemoveConfirmation={paymentMethods.length === 1 && hasActivePaidSubscription}
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

            {!isLoadingMethods &&
              paymentMethods.length === 0 &&
              (!showAddCard ? (
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
              ))}

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
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Spending limit</p>
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">Set a monthly spending cap to control costs</p>
        </div>
        {isEditingLimit ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-dash-text-faded">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={spendingLimitInput}
                onChange={(e) => setSpendingLimitInput(normalizeCurrencyInput(e.target.value))}
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
              {spendingLimitMutation.isPending ? <Spinner size="size-3.5" className="text-white" /> : "Save"}
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
              {hasSpendingLimit ? `$${currentUsage.toFixed(2)} used / $${savedSpendingLimit.toFixed(2)} limit` : "No limit set"}
            </p>
            {canEditSpendingLimit ? (
              paymentMethods.length === 0 ? (
                <SimpleTooltip content="Add a payment method first" side="right">
                  <span className="cursor-not-allowed text-sm font-medium text-[#4879f8] opacity-50">
                    {hasSpendingLimit ? "Edit" : "Set"}
                  </span>
                </SimpleTooltip>
              ) : (
                <button
                  onClick={() => {
                    setSpendingLimitInput(typeof savedSpendingLimit === "number" ? String(savedSpendingLimit) : "5");
                    setIsEditingLimit(true);
                  }}
                  className="text-sm font-medium text-[#4879f8] hover:text-[#3a6ae6]"
                >
                  {hasSpendingLimit ? "Edit" : "Set"}
                </button>
              )
            ) : (
              <span className="text-xs text-dash-text-extra-faded">Only the workspace creator can update this limit</span>
            )}
          </div>
        )}
      </div>

      <hr className="-ml-8 border-dash-border-soft" />

      {/* ── Invoices ── */}
      <InvoicesSection
        invoices={invoices}
        isTeamMode={isTeamMode}
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
        onPayInvoice={handlePayInvoice}
        payingInvoiceId={payingInvoiceId}
      />

      {hasActivePaidSubscription && (
        <>
          <hr className="-ml-8 border-dash-border-soft" />

          {/* ── Cancel subscription ── */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-[2px] py-2">
              <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Manage your subscription</p>
              <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">Cancel your current subscription</p>
            </div>
            <div>
              <GlossyButton variant="red" onClick={() => setCancelOpen(true)}>
                Cancel subscription
              </GlossyButton>
            </div>
          </div>

          <CancelSubscriptionModal open={cancelOpen} onOpenChange={setCancelOpen} currentPlan={currentPlan} />
        </>
      )}

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

function PaymentFailureBanner({ daysSinceFailure }: { daysSinceFailure: number }) {
  if (daysSinceFailure <= 0) return null;

  const isBuildsDisabled = daysSinceFailure >= 7;
  const isDeactivated = daysSinceFailure >= 14;

  return (
    <div
      className={`rounded-[4px] border px-4 py-3 ${isDeactivated ? "border-[#ef2f1f]/30 bg-[#ef2f1f]/[0.06]" : "border-[#f5a623]/30 bg-[#f5a623]/[0.06]"}`}
    >
      <p className={`text-sm font-medium leading-5 ${isDeactivated ? "text-[#ef2f1f]" : "text-[#b37a10] dark:text-[#f5a623]"}`}>
        {isDeactivated
          ? "Your subscription has been deactivated. Update payment to reactivate."
          : isBuildsDisabled
            ? "Builds are disabled due to payment failure. Update your payment method to resume."
            : `Payment failed ${daysSinceFailure} day${daysSinceFailure === 1 ? "" : "s"} ago. Please update your payment method.`}
      </p>
    </div>
  );
}

/* ── Forecasted bill ── */

function BillForecast({ stats, hasOpenInvoice }: { stats?: SubscriptionStats | null; hasOpenInvoice?: boolean }) {
  if (!stats) return null;

  const nextPaymentDate = stats.next_payment_date
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(stats.next_payment_date))
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-dash-text-faded">Forecasted bill</p>
          <p className="text-3xl font-semibold tabular-nums text-dash-text-strong">{stats.total}</p>
        </div>
        {nextPaymentDate && (
          <div className="flex flex-col items-end gap-1">
            <p className="text-xs font-medium uppercase tracking-wider text-dash-text-faded">Due at</p>
            <p className="text-sm font-medium text-dash-text-body">{nextPaymentDate}</p>
          </div>
        )}
      </div>
      {hasOpenInvoice && (
        <div className="rounded-[6px] bg-[#f5a623]/5 px-3.5 py-3 dark:bg-[#f5a623]/15">
          <p className="text-sm text-dash-text-body dark:text-dash-text-strong">
            You have an outstanding invoice. Please clear it before your next billing cycle to avoid service interruption.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Usage section ── */

function UsageSection({ spendingLimit, usage }: { spendingLimit?: number | null; usage?: number }) {
  const used = usage ?? 0;
  const hasSpendingLimit = typeof spendingLimit === "number" && Number.isFinite(spendingLimit) && spendingLimit >= 5;
  const limit = hasSpendingLimit ? spendingLimit : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-[2px]">
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Current usage</p>
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">Billing usage for the current period</p>
        </div>

        {limit ? (
          <UsageBar label="Spending budget" used={used} limit={limit} unit="USD" overageNote="Overage may be added to the next invoice" />
        ) : (
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">No spending budget configured yet.</p>
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
        <div className={`h-full rounded-full transition-all ${isOver ? "bg-[#f5a623]" : "bg-[#4879f8]"}`} style={{ width: `${pct}%` }} />
      </div>
      {overage > 0 && overageNote && (
        <p className="text-xs text-[#f5a623]">
          {overage.toLocaleString()} {unit} overage — {overageNote}
        </p>
      )}
    </div>
  );
}

/* ── Usage breakdown (per-resource) ── */

type UsageResource = {
  key: keyof Omit<UsageBreakdownData, "metered_total">;
  label: string;
  iconSrc: string;
  // API returns every `quantity` in milli-units; divide by 1000 for the displayed value.
  unit: string;
  tooltip: string;
};

// All quantities arrive as milli-units, so the display value is always quantity / 1000.
const QUANTITY_FACTOR = 0.001;

const USAGE_GROUPS: ReadonlyArray<{ label: string; resources: ReadonlyArray<UsageResource> }> = [
  {
    label: "Projects",
    resources: [
      {
        key: "cpu",
        label: "CPU",
        iconSrc: "/icons/cpu.svg",
        unit: "GB-month",
        tooltip: "Project vCPU usage beyond your plan's included amount.",
      },
      {
        key: "memory",
        label: "Memory",
        iconSrc: "/icons/memory.svg",
        unit: "GB-month",
        tooltip: "Project memory usage beyond your plan's included amount.",
      },
      {
        key: "bandwidth",
        label: "Bandwidth",
        iconSrc: "/icons/outgoing-data.svg",
        unit: "GB",
        tooltip: "Outbound (egress) bandwidth beyond your plan's included amount.",
      },
    ],
  },
  {
    label: "Sandboxes",
    resources: [
      {
        key: "sandbox_cpu",
        label: "Sandbox CPU",
        iconSrc: "/icons/cpu.svg",
        unit: "vCPU-hours",
        tooltip: "Sandbox vCPU usage beyond your included allowance.",
      },
      {
        key: "sandbox_memory",
        label: "Sandbox memory",
        iconSrc: "/icons/memory.svg",
        unit: "GB-hours",
        tooltip: "Sandbox memory usage beyond your included allowance.",
      },
      {
        key: "sandbox_snapshot_storage",
        label: "Snapshot storage",
        iconSrc: "/icons/disk.svg",
        unit: "GB-month",
        tooltip: "Storage held by sandbox snapshots beyond your included allowance.",
      },
      {
        key: "volume_storage",
        label: "Volume storage",
        iconSrc: "/icons/database.svg",
        unit: "GB-month",
        tooltip: "Persistent volume storage attached to sandboxes beyond your included allowance.",
      },
    ],
  },
];

const quantityFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function UsageResourceRow({
  resource,
  meta,
}: {
  resource: UsageBreakdownData[keyof Omit<UsageBreakdownData, "metered_total">];
  meta: UsageResource;
}) {
  return (
    <SimpleTooltip content={meta.tooltip}>
      <div className="flex cursor-default items-center justify-between rounded-md px-1 py-2 -mx-1 transition-colors hover:bg-dash-bg-elevated">
        <div className="flex items-center gap-2.5">
          <img src={meta.iconSrc} alt="" className="size-4 invert dark:invert-0" />
          <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">{meta.label}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-xs tabular-nums text-dash-text-faded">
            {quantityFormatter.format(resource.quantity * QUANTITY_FACTOR)} {meta.unit}
          </span>
          <span className="text-sm tabular-nums text-dash-text-strong">${resource.amount.toFixed(2)}</span>
        </div>
      </div>
    </SimpleTooltip>
  );
}

function UsageBreakdown({ breakdown, planName, planAmount }: { breakdown: UsageBreakdownData; planName: string; planAmount: number }) {
  const [open, setOpen] = useState(true);
  const meteredTotal = breakdown.metered_total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex items-center justify-between gap-3 text-left"
      >
        <div className="flex flex-col gap-[2px]">
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Usage breakdown</p>
          <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">Metered charges for the current period</p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-sm tabular-nums text-dash-text-strong">${meteredTotal.toFixed(2)}</span>
          <ChevronDown
            className={cn("size-4 text-dash-text-faded transition-transform duration-200", open && "rotate-180")}
            aria-hidden="true"
          />
        </div>
      </button>

      {open && (
        <motion.div
          className="flex flex-col gap-3"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {USAGE_GROUPS.map((group) => {
            const rows = group.resources.filter((meta) => breakdown[meta.key]);
            if (rows.length === 0) return null;
            return (
              <div key={group.label} className="flex flex-col">
                <span className="px-1 py-1 text-xs font-medium uppercase tracking-[0.4px] text-dash-text-faded">{group.label}</span>
                {rows.map((meta) => (
                  <UsageResourceRow key={meta.key} resource={breakdown[meta.key]} meta={meta} />
                ))}
              </div>
            );
          })}

          <div className="border-t border-dash-border-soft" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/icons/renew.svg" alt="" className="size-4 invert dark:invert-0" />
              <span className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">{planName} plan</span>
            </div>
            <span className="text-sm tabular-nums text-dash-text-strong">${planAmount.toFixed(2)}/mo</span>
          </div>
        </motion.div>
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
  requiresRemoveConfirmation = false,
  onChangeCard,
}: {
  method: Record<string, any>;
  isDefault: boolean;
  requiresRemoveConfirmation?: boolean;
  onChangeCard?: () => void;
}) {
  const router = useRouter();
  const removeMutation = useRemovePaymentMethod();
  const setDefaultMutation = useSetDefaultPaymentMethod();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function fireRemove() {
    removeMutation.mutate(method.id, {
      onSuccess: () => {
        toast.success("Payment method removed");
        invalidateActiveMatches(router);
        setConfirmOpen(false);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove payment method"),
    });
  }

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
                onSuccess: () => {
                  toast.success("Default payment method updated");
                  invalidateActiveMatches(router);
                },
                onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to set default"),
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
          onClick={() => {
            if (requiresRemoveConfirmation) {
              setConfirmOpen(true);
            } else {
              fireRemove();
            }
          }}
          className="rounded-[4px] p-1.5 text-dash-text-faded transition-colors hover:bg-[#ef2f1f]/10 hover:text-[#ef2f1f] disabled:pointer-events-none disabled:opacity-40"
          title="Remove"
        >
          {removeMutation.isPending ? <Spinner className="size-3.5" /> : <FolderTrashIcon className="size-3.5" />}
        </button>
      </div>
      <WarningModal
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!removeMutation.isPending) setConfirmOpen(next);
        }}
        title="Remove your only card?"
        description="This is the card we use to renew your paid plan. If you remove it, we won't be able to charge you on your next renewal date — your projects may go offline until you add a new card."
        confirmLabel="Remove anyway"
        confirmLoadingLabel="Removing..."
        confirmDisabled={removeMutation.isPending}
        closeOnConfirm={false}
        onConfirm={fireRemove}
      />
    </div>
  );
}

/* ── Add card form (inline Stripe CardElement) ── */

export function AddCardForm({
  onClose,
  replacePaymentMethodId,
  onSuccess,
  submitLabel,
  showCancel = true,
  showHeader = true,
  animated = true,
}: {
  onClose: () => void;
  replacePaymentMethodId?: string | null;
  onSuccess?: (paymentMethodId: string) => void;
  submitLabel?: string;
  showCancel?: boolean;
  showHeader?: boolean;
  animated?: boolean;
}) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const addMethodMutation = useAddPaymentMethod();
  const confirmMethodMutation = useConfirmPaymentMethod();
  const removeMethodMutation = useRemovePaymentMethod();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardError, setCardError] = useState(false);
  const [isDark, setIsDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const cardOptions: StripeCardElementOptions = useMemo(
    () => ({
      style: {
        base: {
          fontSize: "14px",
          lineHeight: "24px",
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          color: isDark ? "#e8eaed" : "#111214",
          backgroundColor: "transparent",
          "::placeholder": { color: isDark ? "#6b7280" : "#9ca3af" },
          ":-webkit-autofill": {
            color: isDark ? "#e8eaed" : "#111214",
          },
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

  function buildCardSetupReturnUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("card_setup", "1");
    return url.toString();
  }

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
      const { paymentMethod, error: createError } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
      });

      if (createError) {
        throw new Error(createError.message ?? "Failed to create payment method");
      }

      const paymentMethodId = String(paymentMethod?.id ?? "").trim();

      if (!paymentMethodId) {
        throw new Error("No payment method returned");
      }

      const addResult = await addMethodMutation.mutateAsync({
        payment_method: paymentMethodId,
        return_url: buildCardSetupReturnUrl(),
      });

      if (addResult.status === "pending") {
        const nextActionResult = await stripe.handleNextAction({
          clientSecret: addResult.data.client_secret,
        });

        if (nextActionResult.error) {
          throw new Error(nextActionResult.error.message ?? "3D Secure confirmation failed");
        }

        await confirmMethodMutation.mutateAsync(addResult.data.setup_intent_id);
      }

      if (replacePaymentMethodId && replacePaymentMethodId !== paymentMethodId) {
        try {
          await removeMethodMutation.mutateAsync(replacePaymentMethodId);
        } catch (removeError) {
          toast.error(removeError instanceof Error ? removeError.message : "New card added, but the old card could not be removed");
        }
      }

      toast.success(replacePaymentMethodId ? "Payment method updated successfully" : "Payment method added successfully");
      if (onSuccess) {
        onSuccess(paymentMethodId);
      } else {
        invalidateActiveMatches(router);
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add payment method");
    } finally {
      setIsSubmitting(false);
    }
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-px pb-px">
      {showHeader && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-dash-text-strong">{replacePaymentMethodId ? "Change card" : "Add a new card"}</p>
          <button type="button" onClick={onClose} className="rounded-[4px] p-1 text-dash-text-faded hover:text-dash-text-body">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div
        className={`input-base flex h-[50px] items-center overflow-hidden px-3 [&_.StripeElement]:w-full ${cardError ? "!shadow-[0_0_0_1px_#ef2f1f,0_0_0_3px_rgba(239,47,31,0.15)]" : "input-focus-within"}`}
      >
        <CardElement options={cardOptions} onChange={(e) => setCardError(!!e.error)} />
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
            (submitLabel ?? "Add card")
          )}
        </button>
        {showCancel && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-[34px] items-center rounded-[4px] border border-dash-border bg-dash-bg px-3.5 text-sm font-medium text-dash-text-strong shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-colors hover:bg-dash-bg-elevated"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  if (!animated) {
    return formContent;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      {formContent}
    </motion.div>
  );
}

/* ── Invoices section ── */

function InvoicesSection({
  invoices,
  isTeamMode,
  page,
  onNextPage,
  onPreviousPage,
  onPayInvoice,
  payingInvoiceId,
}: {
  invoices?: {
    items: Array<{
      id: string;
      number?: string;
      total?: string;
      status: string;
      invoice_pdf?: string;
      hosted_invoice_url?: string;
      date: string;
      source?: "subscription" | "purchase";
      type?: string;
    }>;
    next_cursor: string | null;
    previous_cursor: string | null;
    has_more: boolean;
  } | null;
  isTeamMode?: boolean;
  page: number;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onPayInvoice: (invoice: { id: string; hosted_invoice_url?: string }) => void;
  payingInvoiceId: string | null;
}) {
  const items = invoices?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-[2px] py-2">
        <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Payment history and invoices</p>
        <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">
          {isTeamMode ? "View this team's billing history and invoices" : "See your billing history with Brimble including invoices"}
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

          const isPurchase = invoice.source === "purchase" || (!invoice.source && invoice.number?.startsWith("BRIMBLE-"));

          const displayNumber = invoice.number
            ? invoice.number.length > 20
              ? `${invoice.number.slice(0, 16)}...${invoice.number.slice(-4)}`
              : invoice.number
            : "Invoice";

          const isOpen = invoice.status === "open";

          return (
            <div key={invoice.id} className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-sm leading-5 tracking-[-0.0224px] text-dash-text-body">{displayNumber}</p>
                  {invoice.number ? <InvoiceReferenceCopyButton reference={invoice.number} /> : null}
                </div>
                <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">{label}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={cn("flex items-center gap-1.5 text-xs", isOpen ? "text-[#f5a623]" : "text-dash-text-extra-faded")}>
                  {isOpen && (
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#f5a623] opacity-75" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-[#f5a623]" />
                    </span>
                  )}
                  {invoice.status} {invoice.total ? `• ${invoice.total}` : ""}
                </span>
                {isOpen ? (
                  <button
                    type="button"
                    onClick={() => onPayInvoice({ id: invoice.id, hosted_invoice_url: invoice.hosted_invoice_url })}
                    disabled={payingInvoiceId === invoice.id}
                    className="rounded-[8px] border border-dash-border bg-dash-bg px-3 py-1.5 text-sm leading-5 tracking-[-0.0224px] text-dash-text-body transition-colors hover:bg-dash-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {payingInvoiceId === invoice.id ? "Paying..." : "Pay now"}
                  </button>
                ) : invoice.invoice_pdf ? (
                  isPurchase ? (
                    <a
                      href={invoice.invoice_pdf}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-[8px] border border-dash-border bg-dash-bg px-3 py-1.5 text-sm leading-5 tracking-[-0.0224px] text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
                    >
                      View receipt
                      <ArrowSquareOut className="size-3.5" weight="regular" />
                    </a>
                  ) : (
                    <a
                      href={invoice.invoice_pdf}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[8px] border border-dash-border bg-dash-bg px-3 py-1.5 text-sm leading-5 tracking-[-0.0224px] text-dash-text-body transition-colors hover:bg-dash-bg-elevated"
                    >
                      Download
                    </a>
                  )
                ) : null}
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-faded">No invoices yet.</p>}
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

function InvoiceReferenceCopyButton({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(reference);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
      className="shrink-0 rounded-[4px] p-1 text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-body"
      title={copied ? "Copied" : "Copy reference"}
      aria-label={copied ? "Reference copied" : "Copy reference"}
    >
      {copied ? <Check className="size-3.5 text-[#34d399]" /> : <Copy className="size-3.5" />}
    </button>
  );
}
