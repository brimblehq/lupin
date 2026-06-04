import { useEffect, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, ChevronDown } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { ToggleSwitch } from "@/components/shared/toggle-switch";
import { Dropdown, type DropdownOption } from "@/components/shared/dropdown";
import { GlossyButton } from "@/components/shared/glossy-button";
import { Spinner } from "@/components/shared/spinner";
import { dashInputClassName } from "@/components/shared/dash-input";
import { hapticToast as toast } from "@/utils/haptic-toast";
import type { RatelimitSettings, RateLimitZone } from "@/backend/ratelimits";
import { getRatelimitSettingsServerFn, updateRatelimitSettingsServerFn } from "@/server/ratelimits/actions";

interface RateLimitDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  workspace?: string;
}

const NO_SPINNER = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const WINDOW_OPTIONS: DropdownOption[] = [
  { id: "10s", label: "10 seconds" },
  { id: "60s", label: "1 minute" },
  { id: "120s", label: "2 minutes" },
  { id: "300s", label: "5 minutes" },
  { id: "600s", label: "10 minutes" },
  { id: "3600s", label: "1 hour" },
];

const WINDOW_VALUES = WINDOW_OPTIONS.map((option) => option.id);

const KEY_OPTIONS: DropdownOption[] = [
  { id: "ip.src", label: "Client IP", description: "Count requests per client IP address." },
  { id: "cf.unique_visitor_id", label: "Unique visitor", description: "Count per unique visitor identified at the edge." },
  { id: "http.request.uri.path", label: "Request path", description: "Count per requested URL path." },
];

const LIST_SEPARATOR = /[\n,]/;
// A path token: no whitespace and not a full URL (no scheme://host). Backend adds the leading "/".
const PATH_PATTERN = /^(?!\w+:\/\/)\S+$/;

function isValidPath(value: string): boolean {
  return PATH_PATTERN.test(value);
}

interface ZoneForm {
  id: string;
  name: string;
  key: string;
  window: string;
  events: number;
  methods: string[];
  pathsText: string;
  ipv4Prefix?: number;
  ipv6Prefix?: number;
}

interface RateLimitForm {
  enabled: boolean;
  zones: ZoneForm[];
}

function makeZone(): ZoneForm {
  return { id: crypto.randomUUID(), name: "New rule", key: "ip.src", window: "60s", events: 100, methods: [], pathsText: "" };
}

function parseList(text: string): string[] {
  return text
    .split(LIST_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toForm(settings: RatelimitSettings): RateLimitForm {
  return {
    enabled: settings.enabled ?? true,
    zones: (settings.zones ?? []).map((zone) => ({
      id: crypto.randomUUID(),
      name: zone.name,
      key: zone.key,
      window: WINDOW_VALUES.includes(zone.window) ? zone.window : "60s",
      events: zone.events,
      methods: zone.matcher?.methods ?? [],
      pathsText: (zone.matcher?.paths ?? []).join("\n"),
      ipv4Prefix: zone.ipv4Prefix,
      ipv6Prefix: zone.ipv6Prefix,
    })),
  };
}

function toZones(form: RateLimitForm): RateLimitZone[] {
  return form.zones.map((zone) => {
    const paths = parseList(zone.pathsText);
    const matcher = {
      ...(zone.methods.length ? { methods: zone.methods } : {}),
      ...(paths.length ? { paths } : {}),
    };
    return {
      name: zone.name.trim(),
      key: zone.key,
      window: zone.window,
      events: zone.events,
      ...(matcher.methods || matcher.paths ? { matcher } : {}),
      ...(zone.ipv4Prefix !== undefined ? { ipv4Prefix: zone.ipv4Prefix } : {}),
      ...(zone.ipv6Prefix !== undefined ? { ipv6Prefix: zone.ipv6Prefix } : {}),
    };
  });
}

export function RateLimitDrawer({ open, onOpenChange, projectId, workspace }: RateLimitDrawerProps) {
  const getSettings = useServerFn(getRatelimitSettingsServerFn as any) as (args: {
    data: { projectId: string; workspace?: string };
  }) => Promise<RatelimitSettings>;
  const updateSettings = useServerFn(updateRatelimitSettingsServerFn as any) as (args: {
    data: { projectId: string; workspace?: string; enabled?: boolean; zones?: RateLimitZone[] };
  }) => Promise<RatelimitSettings>;

  const [form, setForm] = useState<RateLimitForm | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getSettings({ data: { projectId, workspace } })
      .then((result) => {
        if (!cancelled) setForm(toForm(result));
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error((error as Error)?.message || "Couldn't load rate limit settings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, workspace, getSettings]);

  function updateZone(id: string, patch: Partial<ZoneForm>) {
    setForm((prev) => (prev ? { ...prev, zones: prev.zones.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone)) } : prev));
  }

  function toggleMethod(id: string, method: string) {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            zones: prev.zones.map((zone) => {
              if (zone.id !== id) return zone;
              const has = zone.methods.includes(method);
              return { ...zone, methods: has ? zone.methods.filter((m) => m !== method) : [...zone.methods, method] };
            }),
          }
        : prev,
    );
  }

  function addZone() {
    setForm((prev) => (prev ? { ...prev, zones: [...prev.zones, makeZone()] } : prev));
  }

  function removeZone(id: string) {
    setForm((prev) => (prev ? { ...prev, zones: prev.zones.filter((zone) => zone.id !== id) } : prev));
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const formValid = Boolean(
    form && form.zones.every((zone) => zone.name.trim() && zone.events >= 1 && parseList(zone.pathsText).every(isValidPath)),
  );

  async function handleSave() {
    if (!form || !formValid) return;
    setSaving(true);
    try {
      const result = await updateSettings({ data: { projectId, workspace, enabled: form.enabled, zones: toZones(form) } });
      setForm(toForm(result));
      toast.success("Rate limit configuration saved");
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Couldn't save rate limit settings");
    } finally {
      setSaving(false);
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
              <Drawer.Title className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">
                Rate limit configuration
              </Drawer.Title>
              <p className="mt-1 text-xs text-dash-text-faded">
                Cap how many requests a client can make to protect this project from abuse and traffic spikes.
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

          <div className="scrollbar-subtle flex flex-1 flex-col overflow-y-auto px-6 py-2">
            {loading || !form ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <Spinner size="size-5" className="text-dash-text-faded" />
              </div>
            ) : (
              <>
                <SettingRow
                  title="Enable rate limiting"
                  description="Turn request limiting on for this project. Rules below only apply while this is enabled."
                  control={<ToggleSwitch checked={form.enabled} onChange={(v) => setForm((prev) => (prev ? { ...prev, enabled: v } : prev))} />}
                />

                <div className="flex flex-col">
                  {form.zones.length === 0 ? (
                    <div className="my-4 flex flex-col items-center gap-1 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated/40 px-6 py-8 text-center">
                      <span className="text-sm text-dash-text-faded">No rules yet</span>
                      <span className="text-xs text-dash-text-extra-faded">Add a rule to start limiting requests.</span>
                    </div>
                  ) : null}
                  <AnimatePresence initial={false}>
                    {form.zones.map((zone, index) => (
                      <motion.div
                        key={zone.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="-mx-2 overflow-hidden px-2"
                      >
                        <ZoneCard
                          zone={zone}
                          index={index}
                          expanded={expanded.has(zone.id)}
                          onChange={(patch) => updateZone(zone.id, patch)}
                          onToggleMethod={(method) => toggleMethod(zone.id, method)}
                          onToggleExpanded={() => toggleExpanded(zone.id)}
                          onRemove={() => removeZone(zone.id)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <button
                    type="button"
                    onClick={addZone}
                    className="mt-4 inline-flex w-fit items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-dash-border px-3 py-2.5 text-sm text-dash-text-body transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong"
                  >
                    <Plus className="size-3.5" />
                    Add rule
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t-[0.5px] border-dash-border px-6 py-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-10 rounded-[6px] px-4 text-sm font-medium text-dash-text-body transition-colors hover:bg-dash-bg-elevated hover:text-dash-text-strong disabled:pointer-events-none disabled:opacity-50"
            >
              Cancel
            </button>
            <GlossyButton
              variant="black"
              type="button"
              onClick={() => void handleSave()}
              disabled={!form || loading || saving || !formValid}
              loading={saving}
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

interface ZoneCardProps {
  zone: ZoneForm;
  index: number;
  expanded: boolean;
  onChange: (patch: Partial<ZoneForm>) => void;
  onToggleMethod: (method: string) => void;
  onToggleExpanded: () => void;
  onRemove: () => void;
}

function ZoneCard({ zone, index, expanded, onChange, onToggleMethod, onToggleExpanded, onRemove }: ZoneCardProps) {
  const invalidPaths = parseList(zone.pathsText).filter((path) => !isValidPath(path));

  return (
    <div className="flex flex-col gap-4 border-b-[0.5px] border-dash-border py-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-dash-text-faded">Rule {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove rule ${index + 1}`}
          className="shrink-0 transition-opacity hover:opacity-70"
        >
          <img src="/icons/folder-trash.svg" alt="" className="size-4 dark:invert" />
        </button>
      </div>

      <Field label="Name">
        <input
          type="text"
          value={zone.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="e.g. API requests"
          className={`${dashInputClassName} text-sm`}
        />
      </Field>

      <Field label="Limit">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={zone.events}
            onChange={(event) => onChange({ events: Number(event.target.value) || 0 })}
            className={`${dashInputClassName} ${NO_SPINNER} w-24 text-sm`}
          />
          <span className="shrink-0 text-sm text-dash-text-faded">requests per</span>
          <div className="w-[160px]">
            <Dropdown value={zone.window} options={WINDOW_OPTIONS} onChange={(v) => onChange({ window: v })} menuMinWidth={200} />
          </div>
        </div>
      </Field>

      <Field label="Methods" hint="Leave empty to apply to every method.">
        <div className="flex flex-wrap gap-1.5">
          {METHODS.map((method) => {
            const active = zone.methods.includes(method);
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

      <Field label="Paths" hint="One per line. Leave empty to apply to all paths.">
        <textarea
          value={zone.pathsText}
          onChange={(event) => onChange({ pathsText: event.target.value })}
          rows={2}
          placeholder={"/api/*\n/login"}
          className={`${dashInputClassName} min-h-[56px] resize-y font-mono text-xs ${
            invalidPaths.length ? "ring-1 ring-red-400/60" : ""
          }`}
        />
        {invalidPaths.length > 0 ? (
          <span className="text-[11px] leading-[1.4] text-red-400">
            Invalid {invalidPaths.length === 1 ? "path" : "paths"}: {invalidPaths.join(", ")}. Use a path like /login — no spaces or full
            URLs.
          </span>
        ) : null}
      </Field>

      <button
        type="button"
        onClick={onToggleExpanded}
        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-dash-text-faded transition-colors hover:text-dash-text-strong"
      >
        <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        Advanced
      </button>

      {expanded ? (
        <div className="flex flex-col gap-4 border-t-[0.5px] border-dash-border pt-4">
          <Field label="Rate limit key" hint="What each request is counted against.">
            <Dropdown value={zone.key} options={KEY_OPTIONS} onChange={(v) => onChange({ key: v })} />
          </Field>
          <div className="flex gap-3">
            <Field label="IPv4 prefix" hint="0–32">
              <input
                type="number"
                min={0}
                max={32}
                value={zone.ipv4Prefix ?? ""}
                onChange={(event) => onChange({ ipv4Prefix: event.target.value === "" ? undefined : Number(event.target.value) })}
                placeholder="32"
                className={`${dashInputClassName} ${NO_SPINNER} w-full text-sm`}
              />
            </Field>
            <Field label="IPv6 prefix" hint="0–128">
              <input
                type="number"
                min={0}
                max={128}
                value={zone.ipv6Prefix ?? ""}
                onChange={(event) => onChange({ ipv6Prefix: event.target.value === "" ? undefined : Number(event.target.value) })}
                placeholder="128"
                className={`${dashInputClassName} ${NO_SPINNER} w-full text-sm`}
              />
            </Field>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SettingRow({ title, description, control }: { title: string; description: string; control: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b-[0.5px] border-dash-border py-4">
      <div className="min-w-0">
        <span className="text-sm font-medium text-dash-text-strong">{title}</span>
        <p className="mt-1 text-xs leading-relaxed text-dash-text-faded">{description}</p>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-dash-text-strong">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-[1.4] text-dash-text-extra-faded">{hint}</span> : null}
    </label>
  );
}
