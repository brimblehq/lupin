import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import config from "@/config";

const stripePromise = config.stripePublishableKey
  ? loadStripe(config.stripePublishableKey)
  : null;

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  return stripePromise ? (
    <Elements stripe={stripePromise}>{children}</Elements>
  ) : (
    <>{children}</>
  );
}
