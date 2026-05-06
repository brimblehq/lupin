import { Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

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
  /** Per-row error messages keyed by ip.id. Empty / missing entries render normally. */
  errors?: Record<string | number, string | undefined>;
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
  errors,
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
        <AnimatePresence initial={false}>
          {ips.map((ip) => {
            const error = errors?.[ip.id];
            return (
              <motion.div
                key={ip.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-1"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="0.0.0.0/0"
                    value={ip.value}
                    aria-invalid={Boolean(error) || undefined}
                    onChange={(e) => onUpdate?.(ip.id, e.target.value)}
                    className={`flex-1 px-3 py-2 font-family-mono text-[13px] text-dash-text-strong placeholder:text-dash-text-extra-faded ${inputClassName} ${
                      error ? "input-error" : "input-base input-focus"
                    }`}
                  />
                  <button
                    onClick={() => onRemove?.(ip.id)}
                    className="flex size-7 items-center justify-center rounded-[4px] text-dash-text-faded transition-colors hover:text-dash-text-strong"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                {error ? <span className="pl-0.5 text-xs text-[#ef4444]">{error}</span> : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <button onClick={onAdd} className="mt-2 flex items-center gap-1.5 text-sm text-[#4879f8] transition-colors hover:text-[#3a6ae6]">
        <Plus className="size-3.5" />
        Add IP address
      </button>
      {ips.length === 0 && (
        <p className="mt-2 text-xs text-dash-text-extra-faded">No IPs whitelisted. Only Brimble internal services will have access.</p>
      )}
    </div>
  );
}
