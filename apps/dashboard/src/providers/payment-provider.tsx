import { useMemo } from "react";
import { Elements } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import config from "@/config";

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const stripePromise = useMemo<Promise<Stripe | null> | null>(() => {
    if (!config.stripePublishableKey) return null;
    return import("@stripe/stripe-js").then(({ loadStripe }) =>
      loadStripe(config.stripePublishableKey!),
    );
  }, []);

  return stripePromise ? (
    <Elements stripe={stripePromise}>{children}</Elements>
  ) : (
    <>{children}</>
  );
}
