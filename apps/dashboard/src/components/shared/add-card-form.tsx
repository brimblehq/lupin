import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { useElements, useStripe, CardElement } from "@stripe/react-stripe-js";
import type { StripeCardElementOptions } from "@stripe/stripe-js";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useAddPaymentMethod, useConfirmPaymentMethod, useRemovePaymentMethod } from "@/hooks/use-payments";
import { invalidateActiveMatches } from "@/utils/router-invalidate";
import { dashInputClassName } from "@/components/shared/dash-input";
import { Spinner } from "@/components/shared/spinner";

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
        void invalidateActiveMatches(router);
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
        className={`${dashInputClassName} flex h-[50px] items-center overflow-hidden px-3 [&_.StripeElement]:w-full ${cardError ? "!shadow-[0_0_0_1px_#ef2f1f,0_0_0_3px_rgba(239,47,31,0.15)]" : "input-focus-within"}`}
      >
        <CardElement options={cardOptions} onChange={(event) => setCardError(Boolean(event.error))} />
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
