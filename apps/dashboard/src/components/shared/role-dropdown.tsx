import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export const TEAM_ROLES: Array<{ value: string; label: string; description: string }> = [
  { value: "Member", label: "Member", description: "Can access assigned environments and deploy" },
  { value: "Administrator", label: "Administrator", description: "Can manage members, environments, and settings" },
  { value: "Viewer", label: "Viewer", description: "Read-only access to assigned environments" },
];

export function RoleDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input-base flex h-full w-[140px] items-center justify-between px-3 py-2.5 text-sm text-dash-text-strong"
      >
        {value}
        <ChevronDown className={`size-3.5 text-dash-text-faded transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[220px] rounded-lg border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg">
          {TEAM_ROLES.map((role) => (
            <button
              type="button"
              key={role.value}
              onClick={() => {
                onChange(role.label);
                setOpen(false);
              }}
              className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
                role.label === value ? "bg-dash-bg-elevated" : "hover:bg-dash-bg-elevated"
              }`}
            >
              <span className={`text-sm ${role.label === value ? "font-medium text-[#4879f8]" : "text-dash-text-body"}`}>{role.label}</span>
              <span className="text-[11px] leading-tight text-dash-text-extra-faded">{role.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
