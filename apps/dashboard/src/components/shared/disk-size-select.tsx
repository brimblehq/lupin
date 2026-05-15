import { Dropdown, type DropdownOption } from "./dropdown";
import { diskSizes } from "./disk-size-options";

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
