import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { DeveloperTrialResult, OutstandingDeveloperTrialInvoiceData, Subscription } from "@/backend/payments";
import config from "@/config";
import { getSubscriptionServerFn, startDeveloperTrialServerFn } from "@/server/payments/actions";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { invalidateActiveMatchesWithRoot } from "@/utils/router-invalidate";

const startDeveloperTrial = startDeveloperTrialServerFn as () => Promise<DeveloperTrialResult>;
const getSubscription = getSubscriptionServerFn as () => Promise<Subscription | null>;

export function hasOutstandingInvoices(data: OutstandingDeveloperTrialInvoiceData | null): data is OutstandingDeveloperTrialInvoiceData {
  return Boolean(data?.invoices.length);
}

export function useDeveloperTrial({ onSuccess }: { onSuccess?: () => void } = {}) {
  const router = useRouter();
  const startTrial = useServerFn(startDeveloperTrial);
  const refreshSubscription = useServerFn(getSubscription);
  const [loading, setLoading] = useState(false);
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingDeveloperTrialInvoiceData | null>(null);

  async function handlePendingConfirmation(result: Extract<DeveloperTrialResult, { status: "pending" }>): Promise<boolean> {
    const clientSecret = result.data.client_secret;
    if (!clientSecret) {
      toast.error("Payment confirmation is required, but confirmation details are missing.");
      return false;
    }

    if (!config.stripePublishableKey) {
      toast.error("Payment confirmation is unavailable. Please try again later.");
      return false;
    }

    const { loadStripe } = await import("@stripe/stripe-js");
    const stripe = await loadStripe(config.stripePublishableKey);
    if (!stripe) {
      toast.error("Payment confirmation is unavailable. Please try again later.");
      return false;
    }

    const confirmation = await stripe.confirmCardPayment(clientSecret);
    if (confirmation.error) {
      toast.error(confirmation.error.message || "Card confirmation failed.");
      return false;
    }

    toast.success("Developer trial confirmation received.");
    await refreshSubscription();
    await invalidateActiveMatchesWithRoot(router);
    return true;
  }

  async function start() {
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
        onSuccess?.();
        return;
      }

      if (result.status === "pending") {
        const confirmed = await handlePendingConfirmation(result);
        if (confirmed) {
          onSuccess?.();
        }
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

  return { start, loading, outstandingInvoices };
}
