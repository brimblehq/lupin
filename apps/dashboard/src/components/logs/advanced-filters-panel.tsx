import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Plus, X, SlidersHorizontal } from "lucide-react";
import { Dropdown } from "@/components/shared/dropdown";
import { dashInputBaseClassName } from "@/components/shared/dash-input";
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
const MAX_FIELD_CONDITIONS = 7;

const inputClass = dashInputBaseClassName;

interface Props {
  value: AppLogFilters;
  onChange: (next: AppLogFilters) => void;
}

export function AdvancedFiltersPanel({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const fields = value.fields ?? [];
  const canAddField = fields.length < MAX_FIELD_CONDITIONS;

  const activeCount = (value.text?.trim() ? 1 : 0) + fields.filter((c) => c.key.trim() && c.value.trim()).length;

  function addField() {
    if (!canAddField) {
      return;
    }
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
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left">
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
            initial={{ opacity: 0, height: 0, overflow: "hidden" }}
            animate={{
              opacity: 1,
              height: "auto",
              overflow: "hidden",
              transitionEnd: { overflow: "visible" },
            }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.2, ease }}
          >
            <div className="flex flex-col gap-4 border-t-[0.5px] border-dash-border px-3 py-3">
              {/* Field conditions */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-dash-text-faded">Field conditions</span>
                {fields.length === 0 && (
                  <p className="text-xs text-dash-text-extra-faded">
                    Add a JSON field condition (e.g. <span className="font-mono">tag = auth</span>). Dotted paths like{" "}
                    <span className="font-mono">team.name</span> drill into nested objects.
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {fields.map((cond) => {
                      const numeric = NUMERIC_OPS.includes(cond.op);
                      return (
                        <motion.div
                          key={cond.id}
                          layout
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.2, ease }}
                        >
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_112px_minmax(0,1fr)_40px] sm:items-center sm:gap-1.5">
                            <input
                              type="text"
                              placeholder="key"
                              value={cond.key}
                              onChange={(e) => updateField(cond.id, { key: e.target.value })}
                              className={`${inputClass} w-full min-w-0 font-mono`}
                            />
                            <div className="w-full min-w-0">
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
                              className="flex size-10 shrink-0 items-center justify-center rounded-[3px] text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong sm:justify-self-end"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
                <button
                  onClick={addField}
                  disabled={!canAddField}
                  className={`mt-1 flex w-fit items-center gap-1.5 text-xs transition-colors ${
                    canAddField ? "text-[#4879f8] hover:text-[#3a6ae6]" : "cursor-not-allowed text-dash-text-extra-faded"
                  }`}
                >
                  <Plus className="size-3.5" />
                  Add condition
                </button>
                {!canAddField && (
                  <p className="text-[11px] text-dash-text-extra-faded">Maximum of {MAX_FIELD_CONDITIONS} conditions reached.</p>
                )}
              </div>

              {activeCount > 0 && (
                <div className="flex justify-end">
                  <button onClick={clearAll} className="text-xs text-dash-text-faded transition-colors hover:text-dash-text-strong">
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
