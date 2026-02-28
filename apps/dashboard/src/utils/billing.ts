export function formatUsdMonthly(amount: number) {
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}
