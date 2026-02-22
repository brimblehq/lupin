import { useState, useRef, useEffect } from "react";
import { X, ChevronDown, Plus } from "lucide-react";
import {
  Modal,
  ModalHeader,
  ModalFooter,
  ModalCancelButton,
  ModalContinueButton,
} from "../shared/modal";

interface InviteRow {
  id: number;
  email: string;
  role: string;
}

const roles = ["Member", "Admin", "Viewer"];
const COST_PER_SEAT = 10;

let nextId = 1;

function RoleDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
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
        onClick={() => setOpen(!open)}
        className="flex h-full w-[110px] items-center justify-between rounded-[6px] bg-[#f9fafb] px-3 py-2.5 text-sm text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)]"
      >
        {value}
        <ChevronDown className={`size-3.5 text-dash-text-faded transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[110px] rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg py-1 shadow-lg">
          {roles.map((role) => (
            <button
              key={role}
              onClick={() => { onChange(role); setOpen(false); }}
              className={`flex w-full px-3 py-1.5 text-left text-sm transition-colors ${
                role === value
                  ? "font-medium text-[#4879f8]"
                  : "text-dash-text-body hover:bg-dash-bg-elevated"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface InviteMembersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSeats?: number;
}

export function InviteMembersModal({
  open,
  onOpenChange,
  currentSeats = 3,
}: InviteMembersModalProps) {
  const [rows, setRows] = useState<InviteRow[]>([
    { id: nextId++, email: "", role: "Member" },
  ]);

  function addRow() {
    setRows((prev) => [...prev, { id: nextId++, email: "", role: "Member" }]);
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function updateRow(id: number, field: "email" | "role", value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  const filledRows = rows.filter((r) => r.email.trim().length > 0);
  const newSeats = filledRows.length;
  const addedCost = newSeats * COST_PER_SEAT;
  const newTotal = (currentSeats + newSeats) * COST_PER_SEAT;

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={520}>
      <ModalHeader
        title="Invite team members"
        description="They'll receive an email invitation to join this workspace."
      />

      <div className="flex flex-col gap-4 px-6 py-5">
        {/* Invite rows */}
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <input
                type="email"
                placeholder="colleague@company.com"
                value={row.email}
                onChange={(e) => updateRow(row.id, "email", e.target.value)}
                className="flex-1 rounded-[6px] bg-[#f9fafb] px-3 py-2.5 text-sm leading-6 text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] outline-none placeholder:text-[#9ca3af] focus:shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08),0px_0px_0px_3px_rgba(72,121,248,0.15)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08),0px_0px_0px_3px_rgba(72,121,248,0.2)]"
              />
              <RoleDropdown
                value={row.role}
                onChange={(v) => updateRow(row.id, "role", v)}
              />
              <button
                onClick={() => removeRow(row.id)}
                className="flex size-[38px] shrink-0 items-center justify-center rounded-[6px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add another */}
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 self-start text-sm text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
        >
          <Plus className="size-3.5" />
          Add another
        </button>

        {/* Cost preview */}
        {newSeats > 0 && (
          <div className="rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-dash-text-faded">
                {newSeats} new {newSeats === 1 ? "seat" : "seats"} &times; ${COST_PER_SEAT}/mo
              </span>
              <span className="text-sm font-medium text-dash-text-strong">
                +${addedCost}/month
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-dash-border-soft pt-2">
              <span className="text-xs text-dash-text-faded">
                New total ({currentSeats + newSeats} seats)
              </span>
              <span className="text-xs font-medium text-dash-text-strong">
                ${newTotal}/month
              </span>
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        <ModalCancelButton />
        <ModalContinueButton disabled={newSeats === 0}>
          Send invitations
        </ModalContinueButton>
      </ModalFooter>
    </Modal>
  );
}
