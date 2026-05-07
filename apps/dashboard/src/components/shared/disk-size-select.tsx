import { Dropdown, type DropdownOption } from "./dropdown";

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

export function DiskSizeSelect({
  value,
  onChange,
  label = "Disk size",
  options,
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  options?: DropdownOption[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-dash-text-faded">{label}</label>
      <Dropdown value={value} options={options ?? diskSizes} onChange={onChange} />
    </div>
  );
}
