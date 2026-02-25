export const TEAM_MEMBER_SEAT_PRICE_MONTHLY = 5;
export const TEAM_CONCURRENT_BUILD_PRICE_MONTHLY = 7.5;

export function formatUsdMonthly(amount: number) {
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}
