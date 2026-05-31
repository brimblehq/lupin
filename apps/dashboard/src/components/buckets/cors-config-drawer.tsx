import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { X, Plus } from "lucide-react";
import { dashInputClassName } from "@/components/shared/dash-input";
import { FolderTrashIcon } from "@/components/shared/folder-trash-icon";
import { GlossyButton } from "@/components/shared/glossy-button";
import { CORS_METHODS, type CorsMethod, type CorsRule } from "@/backend/storage";

interface CorsConfigDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: CorsRule[];
  onSave: (rules: CorsRule[]) => Promise<void>;
}

interface DraftRule {
  allowedOriginsText: string;
  allowedMethods: CorsMethod[];
  allowedHeadersText: string;
  exposeHeadersText: string;
  maxAgeSecondsText: string;
}

const LIST_SEPARATOR_PATTERN = /[\n,]/;
const TOKEN_PREVIEW_LIMIT = 12;
const CORS_TOKEN_COLOR = "#f5a623";

function ruleToDraft(rule: CorsRule): DraftRule {
  return {
    allowedOriginsText: rule.allowedOrigins.join("\n"),
    allowedMethods: rule.allowedMethods,
    allowedHeadersText: (rule.allowedHeaders ?? []).join("\n"),
    exposeHeadersText: (rule.exposeHeaders ?? []).join("\n"),
    maxAgeSecondsText: typeof rule.maxAgeSeconds === "number" ? String(rule.maxAgeSeconds) : "",
  };
}

function parseListItems(text: string): string[] {
  return text
    .split(LIST_SEPARATOR_PATTERN)
    .map((line) => line.trim())
    .filter(Boolean);
}

function draftToRule(draft: DraftRule): CorsRule {
  const allowedOrigins = parseListItems(draft.allowedOriginsText);
  const allowedHeaders = parseListItems(draft.allowedHeadersText);
  const exposeHeaders = parseListItems(draft.exposeHeadersText);
  const maxAgeRaw = draft.maxAgeSecondsText.trim();
  const maxAgeSeconds = maxAgeRaw ? Number(maxAgeRaw) : undefined;
  return {
    allowedOrigins,
    allowedMethods: draft.allowedMethods,
    ...(allowedHeaders.length > 0 ? { allowedHeaders } : {}),
    ...(exposeHeaders.length > 0 ? { exposeHeaders } : {}),
    ...(maxAgeSeconds !== undefined ? { maxAgeSeconds } : {}),
  };
}

function isDraftValid(draft: DraftRule): boolean {
  if (parseListItems(draft.allowedOriginsText).length === 0) return false;
  if (draft.allowedMethods.length === 0) return false;
  if (draft.maxAgeSecondsText.trim()) {
    const n = Number(draft.maxAgeSecondsText);
    if (!Number.isInteger(n) || n < 0) return false;
  }
  return true;
}

const EMPTY_DRAFT: DraftRule = {
  allowedOriginsText: "",
  allowedMethods: [],
  allowedHeadersText: "*",
  exposeHeadersText: "ETag",
  maxAgeSecondsText: "3600",
};

type PresetKey = "dashboard" | "permissive" | "readonly";

function getPresetDraft(key: PresetKey): DraftRule {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  switch (key) {
    case "dashboard":
      return {
        allowedOriginsText: window.location.origin,
        allowedMethods: [...CORS_METHODS],
        allowedHeadersText: "*",
        exposeHeadersText: "ETag",
        maxAgeSecondsText: "3600",
      };
    case "permissive":
      return {
        allowedOriginsText: "*",
        allowedMethods: [...CORS_METHODS],
        allowedHeadersText: "*",
        exposeHeadersText: "ETag",
        maxAgeSecondsText: "0",
      };
    case "readonly":
      return {
        allowedOriginsText: "*",
        allowedMethods: ["GET", "HEAD"],
        allowedHeadersText: "*",
        exposeHeadersText: "ETag",
        maxAgeSecondsText: "3600",
      };
  }
}

export function CorsConfigDrawer({ open, onOpenChange, rules, onSave }: CorsConfigDrawerProps) {
  const [drafts, setDrafts] = useState<DraftRule[]>(() => rules.map(ruleToDraft));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setDrafts(rules.map(ruleToDraft));
  }, [open, rules]);

  const allValid = drafts.every(isDraftValid);

  function updateDraft(index: number, patch: Partial<DraftRule>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function toggleMethod(index: number, method: CorsMethod) {
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const has = d.allowedMethods.includes(method);
        return {
          ...d,
          allowedMethods: has ? d.allowedMethods.filter((m) => m !== method) : [...d.allowedMethods, method],
        };
      }),
    );
  }

  function addRule(preset?: PresetKey) {
    setDrafts((prev) => [...prev, preset ? getPresetDraft(preset) : EMPTY_DRAFT]);
  }

  function removeRule(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    try {
      setSubmitting(true);
      await onSave(drafts.map(draftToRule));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={onOpenChange} noBodyStyles modal>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Drawer.Content
          className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[560px] flex-col border-l-[0.5px] border-dash-border bg-dash-bg shadow-[-4px_0_24px_rgba(0,0,0,0.08)] outline-none"
          aria-describedby={undefined}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b-[0.5px] border-dash-border px-6 py-5">
            <div className="min-w-0">
              <Drawer.Title className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">CORS configuration</Drawer.Title>
              <p className="mt-1 text-xs text-dash-text-faded">
                Allow browser uploads and downloads from other origins. Brimble's own origins are managed for you — don't add them here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="scrollbar-subtle flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            {drafts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/40 px-6 py-10 text-center">
                <span className="text-sm text-dash-text-faded">No rules yet</span>
                <span className="max-w-[320px] text-xs text-dash-text-extra-faded">
                  Pick a preset to get started, or add a blank rule to configure manually.
                </span>
              </div>
            ) : (
              drafts.map((draft, index) => (
                <RuleCard
                  key={index}
                  index={index}
                  draft={draft}
                  showRemove={drafts.length > 0}
                  onChange={(patch) => updateDraft(index, patch)}
                  onToggleMethod={(method) => toggleMethod(index, method)}
                  onRemove={() => removeRule(index)}
                />
              ))
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => addRule()}
                className="inline-flex items-center justify-center gap-1.5 rounded-[4px] border-[0.5px] border-dashed border-dash-border bg-transparent px-3 py-2.5 text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
              >
                <Plus className="size-3.5" />
                Add rule
              </button>
              <div className="flex flex-wrap gap-2">
                <PresetButton onClick={() => addRule("dashboard")}>+ Dashboard origin</PresetButton>
                <PresetButton onClick={() => addRule("permissive")}>+ Permissive (dev)</PresetButton>
                <PresetButton onClick={() => addRule("readonly")}>+ Public read-only</PresetButton>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t-[0.5px] border-dash-border px-6 py-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="h-10 rounded-[6px] px-4 text-sm font-medium text-dash-text-body transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong disabled:pointer-events-none disabled:opacity-50"
            >
              Cancel
            </button>
            <GlossyButton
              variant="black"
              type="button"
              onClick={() => void handleSave()}
              disabled={!allValid || submitting}
              loading={submitting}
              loadingLabel="Saving..."
            >
              Save changes
            </GlossyButton>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function PresetButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[3px] border-[0.5px] border-dash-border bg-dash-bg-elevated/50 px-2 py-1 text-xs text-dash-text-faded transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
    >
      {children}
    </button>
  );
}

interface RuleCardProps {
  index: number;
  draft: DraftRule;
  showRemove: boolean;
  onChange: (patch: Partial<DraftRule>) => void;
  onToggleMethod: (method: CorsMethod) => void;
  onRemove: () => void;
}

function RuleCard({ index, draft, showRemove, onChange, onToggleMethod, onRemove }: RuleCardProps) {
  return (
    <div className="flex flex-col gap-4 border-b-[0.5px] border-dash-border pb-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-dash-text-faded">Rule {index + 1}</span>
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove rule ${index + 1}`}
            title="Remove rule"
            className="inline-flex items-center justify-center align-middle transition-opacity hover:opacity-70"
          >
            <FolderTrashIcon className="size-4" color="#ef2f1f" />
          </button>
        )}
      </div>

      <ListTextareaField
        label="Allowed origins"
        hint="Separate with commas or new lines. Use * to allow any origin."
        value={draft.allowedOriginsText}
        onChange={(allowedOriginsText) => onChange({ allowedOriginsText })}
        placeholder={"https://myapp.com\nhttps://staging.myapp.com"}
        rows={3}
        minHeightClassName="min-h-[72px]"
      />

      <Field label="Allowed methods">
        <div className="flex flex-wrap gap-1.5">
          {CORS_METHODS.map((method) => {
            const active = draft.allowedMethods.includes(method);
            return (
              <button
                key={method}
                type="button"
                onClick={() => onToggleMethod(method)}
                className={`rounded-[3px] border-[0.5px] px-2 py-1 text-xs font-medium uppercase tracking-wider transition-colors ${
                  active
                    ? "border-[#3964d5] bg-[#4879f8] text-white"
                    : "border-dash-border bg-dash-bg text-dash-text-faded hover:bg-dash-bg-elevated hover:text-dash-text-strong"
                }`}
              >
                {method}
              </button>
            );
          })}
        </div>
      </Field>

      <ListTextareaField
        label="Allowed headers"
        hint="Separate with commas or new lines. * allows any request header."
        value={draft.allowedHeadersText}
        onChange={(allowedHeadersText) => onChange({ allowedHeadersText })}
        placeholder="*"
        rows={2}
        minHeightClassName="min-h-[56px]"
      />

      <ListTextareaField
        label="Expose headers"
        hint="Separate with commas or new lines. ETag is required for multipart uploads."
        value={draft.exposeHeadersText}
        onChange={(exposeHeadersText) => onChange({ exposeHeadersText })}
        placeholder="ETag"
        rows={2}
        minHeightClassName="min-h-[56px]"
      />

      <Field label="Max age (seconds)" hint="How long browsers cache the preflight result.">
        <input
          type="number"
          min={0}
          step={1}
          value={draft.maxAgeSecondsText}
          onChange={(e) => onChange({ maxAgeSecondsText: e.target.value })}
          placeholder="3600"
          className={`${dashInputClassName} w-40 text-sm`}
        />
      </Field>
    </div>
  );
}

function ListTextareaField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows,
  minHeightClassName,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
  minHeightClassName: string;
}) {
  const items = parseListItems(value);

  return (
    <Field label={label} hint={hint}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`${dashInputClassName} ${minHeightClassName} resize-y font-mono text-xs`}
      />
      <TokenPreview items={items} />
    </Field>
  );
}

function TokenPreview({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  const visibleItems = items.slice(0, TOKEN_PREVIEW_LIMIT);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <div className="mt-0.5 flex flex-wrap gap-1.5">
      {visibleItems.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="flex max-w-full items-center gap-1.5 rounded-full border border-dash-border px-3 py-1 text-xs font-medium text-dash-text-faded"
        >
          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: CORS_TOKEN_COLOR }} />
          <span className="truncate font-mono">{item}</span>
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="rounded-full bg-dash-bg-elevated px-1.5 py-0.5 text-[10px] leading-none text-dash-text-extra-faded">
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-dash-text-strong">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-[1.4] text-dash-text-extra-faded">{hint}</span>}
    </label>
  );
}
