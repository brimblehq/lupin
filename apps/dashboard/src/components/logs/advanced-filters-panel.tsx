import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Plus, X, SlidersHorizontal } from "lucide-react";
import { Dropdown } from "@/components/shared/dropdown";
import {
  FIELD_OP_LABELS,
  NUMERIC_OPS,
  newFieldCondition,
  type AppLogFilters,
  type FieldCondition,
  type FieldOp,
} from "@/utils/log-filters";

const ease = [0.16, 1, 0.3, 1] as const;

const OP_OPTIONS: FieldOp[] = ["eq", "neq", "contains", "regex", "gte", "lte", "gt", "lt"];

const inputClass =
  "input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]";

interface Props {
  value: AppLogFilters;
  onChange: (next: AppLogFilters) => void;
}

export function AdvancedFiltersPanel({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const fields = value.fields ?? [];

  const activeCount =
    (value.text?.trim() ? 1 : 0) + fields.filter((c) => c.key.trim() && c.value.trim()).length;

  function addField() {
    onChange({ ...value, fields: [...fields, newFieldCondition()] });
  }

  function updateField(id: string, patch: Partial<FieldCondition>) {
    onChange({
      ...value,
      fields: fields.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }

  function removeField(id: string) {
    const next = fields.filter((c) => c.id !== id);
    onChange({ ...value, fields: next.length > 0 ? next : undefined });
  }

  function clearAll() {
    onChange({});
  }

  return (
    <div className="rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm text-dash-text-body">
          <SlidersHorizontal className="size-3.5 text-dash-text-faded" />
          Advanced filters
          {activeCount > 0 && (
            <span className="rounded-[3px] bg-[#4879f8]/15 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[#4879f8]">
              {activeCount}
            </span>
          )}
        </span>
        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2, ease }}>
          <ChevronDown className="size-3.5 text-dash-text-faded" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 border-t-[0.5px] border-dash-border px-3 py-3">
              {/* Field conditions */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-dash-text-faded">Field conditions</span>
                {fields.length === 0 && (
                  <p className="text-xs text-dash-text-extra-faded">
                    Add a JSON field condition (e.g. <span className="font-mono">tag = auth</span>) to narrow results.
                  </p>
                )}
                {fields.map((cond) => {
                  const numeric = NUMERIC_OPS.includes(cond.op);
                  return (
                    <div key={cond.id} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="key"
                        value={cond.key}
                        onChange={(e) => updateField(cond.id, { key: e.target.value })}
                        className={`${inputClass} w-40 shrink-0 font-mono`}
                      />
                      <div className="w-28 shrink-0">
                        <Dropdown
                          value={cond.op}
                          options={OP_OPTIONS as unknown as string[]}
                          onChange={(v) => updateField(cond.id, { op: v as FieldOp })}
                          renderOption={(v) => FIELD_OP_LABELS[v as FieldOp]}
                        />
                      </div>
                      <input
                        type={numeric ? "number" : "text"}
                        placeholder={numeric ? "number" : "value"}
                        value={cond.value}
                        onChange={(e) => updateField(cond.id, { value: e.target.value })}
                        className={`${inputClass} min-w-0 flex-1 font-mono`}
                      />
                      <button
                        onClick={() => removeField(cond.id)}
                        aria-label="Remove condition"
                        className="flex size-10 shrink-0 items-center justify-center rounded-[3px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={addField}
                  className="mt-1 flex w-fit items-center gap-1.5 text-xs text-[#4879f8] transition-colors hover:text-[#3a6ae6]"
                >
                  <Plus className="size-3.5" />
                  Add condition
                </button>
              </div>

              {activeCount > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={clearAll}
                    className="text-xs text-dash-text-faded transition-colors hover:text-dash-text-strong"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
