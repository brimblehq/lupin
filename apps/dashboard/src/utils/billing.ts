import type { PaymentMethod } from "@/backend/payments";

export function formatUsdMonthly(amount: number) {
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export function formatCardType(cardType?: string): string {
  if (!cardType) return "Card";
  const lower = cardType.toLowerCase();
  if (lower === "visa") return "Visa";
  if (lower === "mastercard" || lower === "mc") return "Mastercard";
  if (lower === "amex" || lower === "american_express") return "Amex";
  if (lower === "discover") return "Discover";
  return cardType.charAt(0).toUpperCase() + cardType.slice(1);
}

export interface CardSummary {
  brand: string;
  last4: string;
}

export function resolveCardSummary(method: PaymentMethod | undefined): CardSummary {
  if (!method) return { brand: "Card", last4: "" };
  const source = (method.card ?? (method as unknown as { brand?: string; last4?: string })) as {
    brand?: string;
    last4?: string;
  };
  return {
    brand: formatCardType(source.brand ?? method.type),
    last4: source.last4 ?? "",
  };
}
