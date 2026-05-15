export const STORAGE_PRICE_PER_GB = 0.25;

export function getDiskPricing(pricingFactor = STORAGE_PRICE_PER_GB) {
  return Array.from({ length: 15 }, (_, i) => {
    const size = (i + 1) * 10;
    return {
      id: String(size),
      label: `${size} GB ($${(size * pricingFactor).toFixed(2)}/month)`,
    };
  });
}

export const diskSizes = getDiskPricing();
