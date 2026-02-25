import { Plus, X } from "lucide-react";

export interface IpWhitelistItem {
  id: string | number;
  value: string;
}

interface IpWhitelistProps {
  ips: IpWhitelistItem[];
  readOnly?: boolean;
  onAdd?: () => void;
  onRemove?: (id: string | number) => void;
  onUpdate?: (id: string | number, value: string) => void;
  label?: string;
  emptyText?: string;
  inputClassName?: string;
}

export function IpWhitelist({
  ips,
  readOnly = false,
  onAdd,
  onRemove,
  onUpdate,
  label = "IP Whitelist",
  emptyText = "No IPs whitelisted.",
  inputClassName = "",
}: IpWhitelistProps) {
  if (readOnly) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-dash-text-strong">{label}</span>
        {ips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {ips.map((ip) => (
              <span
                key={ip.id}
                className="rounded-[4px] border border-dash-border bg-dash-bg px-2 py-1 font-family-mono text-xs text-dash-text-body"
              >
                {ip.value}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm font-light text-dash-text-faded">{emptyText}</span>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs text-dash-text-faded">{label}</label>
      <div className="flex flex-col gap-2">
        {ips.map((ip) => (
          <div key={ip.id} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="0.0.0.0/0"
              value={ip.value}
              onChange={(e) => onUpdate?.(ip.id, e.target.value)}
              className={`flex-1 font-family-mono text-[13px] ${inputClassName}`}
            />
            <button
              onClick={() => onRemove?.(ip.id)}
              className="flex size-7 items-center justify-center rounded-[4px] text-dash-text-faded transition-colors hover:text-dash-text-strong"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={onAdd}
        className="mt-2 flex items-center gap-1.5 text-sm text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
      >
        <Plus className="size-3.5" />
        Add IP address
      </button>
      {ips.length === 0 && (
        <p className="mt-2 text-xs text-dash-text-extra-faded">
          No IPs whitelisted. Only Brimble internal services will have access.
        </p>
      )}
    </div>
  );
}
