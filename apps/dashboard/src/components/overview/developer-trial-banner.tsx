import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { DashButton } from "@/components/shared/dash-button";
import type { DeveloperTrialResult, OutstandingDeveloperTrialInvoiceData, Subscription } from "@/backend/payments";
import config from "@/config";
import { resolvePlanKey } from "@/hooks/use-plan-gate";
import { getSubscriptionServerFn, startDeveloperTrialServerFn } from "@/server/payments/actions";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { invalidateActiveMatchesWithRoot } from "@/utils/router-invalidate";

const TRIAL_PLAN_KEYS = new Set<string>(["free", "hacker"]);

const startDeveloperTrial = startDeveloperTrialServerFn as () => Promise<DeveloperTrialResult>;
const getSubscription = getSubscriptionServerFn as () => Promise<Subscription | null>;

function hasOutstandingInvoices(data: OutstandingDeveloperTrialInvoiceData | null): data is OutstandingDeveloperTrialInvoiceData {
  return Boolean(data?.invoices.length);
}

export function DeveloperTrialBanner({
  planType,
  isTeamWorkspace,
  developerTrialStartedAt,
}: {
  planType?: string;
  isTeamWorkspace?: boolean;
  developerTrialStartedAt?: string | null;
}) {
  const router = useRouter();
  const startTrial = useServerFn(startDeveloperTrial);
  const refreshSubscription = useServerFn(getSubscription);
  const [loading, setLoading] = useState(false);
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingDeveloperTrialInvoiceData | null>(null);
  const eligible = !isTeamWorkspace && TRIAL_PLAN_KEYS.has(resolvePlanKey(planType)) && !developerTrialStartedAt;
  if (!eligible) return null;

  async function handlePendingConfirmation(result: Extract<DeveloperTrialResult, { status: "pending" }>) {
    const clientSecret = result.data.client_secret;
    if (!clientSecret) {
      toast.error("Payment confirmation is required, but confirmation details are missing.");
      return;
    }

    if (!config.stripePublishableKey) {
      toast.error("Payment confirmation is unavailable. Please try again later.");
      return;
    }

    const { loadStripe } = await import("@stripe/stripe-js");
    const stripe = await loadStripe(config.stripePublishableKey);
    if (!stripe) {
      toast.error("Payment confirmation is unavailable. Please try again later.");
      return;
    }

    const confirmation = await stripe.confirmCardPayment(clientSecret);
    if (confirmation.error) {
      toast.error(confirmation.error.message || "Card confirmation failed.");
      return;
    }

    toast.success("Developer trial confirmation received.");
    await refreshSubscription();
    await invalidateActiveMatchesWithRoot(router);
  }

  async function handleStartTrial() {
    if (loading) {
      return;
    }

    setLoading(true);
    setOutstandingInvoices(null);

    try {
      const result = await startTrial();

      if (result.status === "success") {
        toast.success(result.message || "You're on the Developer plan — free for the next 14 days.");
        await refreshSubscription();
        await invalidateActiveMatchesWithRoot(router);
        return;
      }

      if (result.status === "pending") {
        await handlePendingConfirmation(result);
        return;
      }

      if (hasOutstandingInvoices(result.data)) {
        setOutstandingInvoices(result.data);
        toast.error(result.message || "Pay outstanding invoices before starting the trial.");
        return;
      }

      toast.error(result.message || "Developer trial could not be started.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Developer trial could not be started.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-8 rounded-[4px] border-[0.5px] border-dash-border px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[6px]">
            <img src="/images/promo.svg" alt="" className="size-10 invert dark:invert-0" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-5 text-dash-text-strong">Try the Developer plan free for 14 days</p>
            <p className="mt-0.5 text-sm font-light leading-[1.3] text-dash-text-faded">
              Unlock unlimited projects, autoscaling, object storage, and more — free for 14 days, no charge.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <DashButton onClick={() => void handleStartTrial()} disabled={loading || hasOutstandingInvoices(outstandingInvoices)}>
            {loading ? "Starting..." : "Start free trial"}
          </DashButton>
        </div>
      </div>
      {hasOutstandingInvoices(outstandingInvoices) && (
        <div className="mt-4 border-t-[0.5px] border-dash-border pt-3">
          <p className="text-xs font-medium text-dash-text-strong">Pay outstanding invoices before starting the trial.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {outstandingInvoices.invoices.map((invoice) => {
              const invoiceUrl = invoice.hosted_invoice_url ?? invoice.invoice_pdf;
              const label = `${invoice.currency.toUpperCase()} ${invoice.amount_due.toFixed(2)}`;

              if (!invoiceUrl) {
                return (
                  <span
                    key={invoice.id}
                    className="rounded-[4px] border-[0.5px] border-dash-border px-2.5 py-1 text-xs text-dash-text-faded"
                  >
                    {label}
                  </span>
                );
              }

              return (
                <a
                  key={invoice.id}
                  href={invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-[4px] border-[0.5px] border-dash-border px-2.5 py-1 text-xs text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
