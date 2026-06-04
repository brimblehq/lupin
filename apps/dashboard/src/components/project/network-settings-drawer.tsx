import { useEffect, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { useServerFn } from "@tanstack/react-start";
import { X, Info, Sparkles } from "lucide-react";
import { ToggleSwitch } from "@/components/shared/toggle-switch";
import { Dropdown, type DropdownOption } from "@/components/shared/dropdown";
import { SimpleTooltip } from "@/components/shared/tooltip";
import { GlossyButton } from "@/components/shared/glossy-button";
import { Spinner } from "@/components/shared/spinner";
import { hapticToast as toast } from "@/utils/haptic-toast";
import type { NetworkSettings, NetworkSyncResult } from "@/backend/networking";
import {
  getNetworkingSettingsServerFn,
  purgeNetworkCacheServerFn,
  updateNetworkingSettingsServerFn,
} from "@/server/networking/actions";

interface NetworkSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  workspace?: string;
}

type TabKey = "cache" | "response" | "firewall";

type NetworkForm = Pick<NetworkSettings, "cache" | "responseRules" | "firewall">;

const TABS: { key: TabKey; label: string }[] = [
  { key: "cache", label: "Cache" },
  { key: "response", label: "Response rules" },
  { key: "firewall", label: "Firewall" },
];

const X_FRAME_VALUES = ["DENY", "SAMEORIGIN", "disabled"] as const;
const X_CONTENT_TYPE_VALUES = ["nosniff", "disabled"] as const;
const X_ROBOTS_VALUES = ["index, follow", "noindex, nofollow", "noindex, follow", "index, nofollow", "disabled"] as const;

const OPTION_LABELS: Record<string, string> = { disabled: "Disabled" };

const X_FRAME_DESCRIPTIONS: Record<string, string> = {
  DENY: "Never allow this site to be shown inside a frame, iframe, or embed.",
  SAMEORIGIN: "Only allow framing when the parent page is on the same origin.",
  disabled: "Don't send the header — any site can frame your pages.",
};

const X_CONTENT_TYPE_DESCRIPTIONS: Record<string, string> = {
  nosniff: "Make browsers respect the declared content type instead of guessing it.",
  disabled: "Don't send the header — browsers may sniff the content type.",
};

const X_ROBOTS_DESCRIPTIONS: Record<string, string> = {
  "index, follow": "Let search engines index this site and follow its links.",
  "noindex, nofollow": "Keep this site out of search results and don't follow its links.",
  "noindex, follow": "Hide this site from search results, but still follow its links.",
  "index, nofollow": "Let search engines index this site, but don't follow its links.",
  disabled: "Don't send the header — pages keep their own indexing rules.",
};

function toOptions(values: readonly string[], descriptions: Record<string, string>): DropdownOption[] {
  return values.map((value) => ({ id: value, label: OPTION_LABELS[value] ?? value, description: descriptions[value] }));
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

const X_FRAME_OPTIONS = toOptions(X_FRAME_VALUES, X_FRAME_DESCRIPTIONS);
const X_CONTENT_TYPE_OPTIONS = toOptions(X_CONTENT_TYPE_VALUES, X_CONTENT_TYPE_DESCRIPTIONS);
const X_ROBOTS_OPTIONS = toOptions(X_ROBOTS_VALUES, X_ROBOTS_DESCRIPTIONS);

function toForm(settings: NetworkSettings): NetworkForm {
  return {
    cache: {
      purgeOnDeploy: settings.cache?.purgeOnDeploy ?? true,
      bypassCache: settings.cache?.bypassCache ?? false,
    },
    responseRules: {
      xFrameOptions: settings.responseRules?.xFrameOptions ?? "DENY",
      xContentTypeOptions: settings.responseRules?.xContentTypeOptions ?? "nosniff",
      xRobotsTag: settings.responseRules?.xRobotsTag ?? "index, follow",
      hstsEnabled: settings.responseRules?.hstsEnabled ?? false,
      markdownForAgents: settings.responseRules?.markdownForAgents ?? false,
    },
    firewall: {
      pathBlocking: settings.firewall?.pathBlocking ?? true,
      browserIntegrityCheck: settings.firewall?.browserIntegrityCheck ?? true,
      underAttackMode: settings.firewall?.underAttackMode ?? false,
    },
  };
}

export function NetworkSettingsDrawer({ open, onOpenChange, projectId, workspace }: NetworkSettingsDrawerProps) {
  const getSettings = useServerFn(getNetworkingSettingsServerFn as any) as (args: {
    data: { projectId: string; workspace?: string };
  }) => Promise<{ settings: NetworkSettings; hosts: string[] }>;
  const updateSettings = useServerFn(updateNetworkingSettingsServerFn as any) as (args: {
    data: { projectId: string; workspace?: string } & Partial<NetworkForm>;
  }) => Promise<{ settings: NetworkSettings; hosts: string[]; sync: NetworkSyncResult }>;
  const purgeCache = useServerFn(purgeNetworkCacheServerFn as any) as (args: {
    data: { projectId: string; workspace?: string };
  }) => Promise<{ hosts: string[]; purged: boolean }>;

  const [activeTab, setActiveTab] = useState<TabKey>("cache");
  const [form, setForm] = useState<NetworkForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setActiveTab("cache");
    setLoading(true);
    getSettings({ data: { projectId, workspace } })
      .then((result) => {
        if (cancelled) return;
        setForm(toForm(result.settings));
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error((error as Error)?.message || "Couldn't load network settings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, workspace, getSettings]);

  function updateCache<K extends keyof NetworkForm["cache"]>(key: K, value: NetworkForm["cache"][K]) {
    setForm((prev) => (prev ? { ...prev, cache: { ...prev.cache, [key]: value } } : prev));
  }

  function updateResponse<K extends keyof NetworkForm["responseRules"]>(key: K, value: NetworkForm["responseRules"][K]) {
    setForm((prev) => (prev ? { ...prev, responseRules: { ...prev.responseRules, [key]: value } } : prev));
  }

  function updateFirewall<K extends keyof NetworkForm["firewall"]>(key: K, value: NetworkForm["firewall"][K]) {
    setForm((prev) => (prev ? { ...prev, firewall: { ...prev.firewall, [key]: value } } : prev));
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const result = await updateSettings({
        data: { projectId, workspace, cache: form.cache, responseRules: form.responseRules, firewall: form.firewall },
      });
      setForm(toForm(result.settings));
      if (result.sync?.synced) {
        toast.success("Network settings saved");
      } else {
        toast("Settings saved. Add a Brimble-hosted domain to apply them at the edge.");
      }
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Couldn't save network settings");
    } finally {
      setSaving(false);
    }
  }

  async function handlePurge() {
    setPurging(true);
    try {
      const result = await purgeCache({ data: { projectId, workspace } });
      if (result.purged) {
        toast.success("Cache purge requested");
      } else {
        toast("No Brimble-hosted domains to purge yet.");
      }
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Couldn't purge cache");
    } finally {
      setPurging(false);
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
          <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-0 pt-5">
            <div className="min-w-0">
              <Drawer.Title className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">
                Network edge settings
              </Drawer.Title>
              <p className="mt-1 text-xs text-dash-text-faded">
                Control how Brimble's edge serves this project — caching, response headers, and firewall protection.
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

          <div className="mt-4 shrink-0 border-b-[0.5px] border-dash-border px-4">
            <div className="flex">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap px-3 py-2.5 text-sm transition-colors ${
                    activeTab === tab.key
                      ? "border-b-2 border-[#f5a623] font-medium text-[#f5a623]"
                      : "font-light text-dash-text-faded hover:text-dash-text-body"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="scrollbar-subtle flex flex-1 flex-col overflow-y-auto px-6 py-2">
            {loading || !form ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <Spinner size="size-5" className="text-dash-text-faded" />
              </div>
            ) : (
              <>
                {activeTab === "cache" && (
                  <>
                    <SettingRow
                      title="Purge cache on deploy"
                      description="Clear this project's edge cache automatically after every successful deployment."
                      control={<ToggleSwitch checked={form.cache.purgeOnDeploy} onChange={(v) => updateCache("purgeOnDeploy", v)} />}
                    />
                    <SettingRow
                      title="Purge cache now"
                      description="Immediately clear all cached responses at the edge."
                      control={
                        <button
                          type="button"
                          onClick={() => void handlePurge()}
                          disabled={purging}
                          className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border-[0.5px] border-dash-border px-3 text-sm font-medium text-dash-text-strong transition-colors hover:bg-dash-bg-elevated disabled:opacity-60"
                        >
                          <Sparkles className="size-3.5" />
                          {purging ? "Purging…" : "Purge cache"}
                        </button>
                      }
                    />
                    <SettingRow
                      title="Bypass cache"
                      description="Skip the edge cache and serve every request from origin. Slower — avoid this in production."
                      control={<ToggleSwitch checked={form.cache.bypassCache} onChange={(v) => updateCache("bypassCache", v)} />}
                    />
                  </>
                )}

                {activeTab === "response" && (
                  <>
                    <SettingRow
                      title="X-Frame-Options"
                      description="Decide whether other sites can embed your pages in a frame, iframe, or embed."
                      control={
                        <div className="w-[180px]">
                          <Dropdown
                            value={form.responseRules.xFrameOptions}
                            options={X_FRAME_OPTIONS}
                            menuMinWidth={320}
                            onChange={(v) => {
                              if (isOneOf(X_FRAME_VALUES, v)) updateResponse("xFrameOptions", v);
                            }}
                          />
                        </div>
                      }
                    />
                    <SettingRow
                      title="X-Content-Type-Options"
                      description="Stop browsers from second-guessing the declared content type."
                      control={
                        <div className="w-[180px]">
                          <Dropdown
                            value={form.responseRules.xContentTypeOptions}
                            options={X_CONTENT_TYPE_OPTIONS}
                            menuMinWidth={320}
                            onChange={(v) => {
                              if (isOneOf(X_CONTENT_TYPE_VALUES, v)) updateResponse("xContentTypeOptions", v);
                            }}
                          />
                        </div>
                      }
                    />
                    <SettingRow
                      title="X-Robots-Tag"
                      description="Set how search engines are allowed to index and crawl this project."
                      control={
                        <div className="w-[180px]">
                          <Dropdown
                            value={form.responseRules.xRobotsTag}
                            options={X_ROBOTS_OPTIONS}
                            menuMinWidth={320}
                            onChange={(v) => {
                              if (isOneOf(X_ROBOTS_VALUES, v)) updateResponse("xRobotsTag", v);
                            }}
                          />
                        </div>
                      }
                    />
                    <SettingRow
                      title="Strict-Transport-Security (HSTS)"
                      description="Require every visitor to connect over HTTPS."
                      control={<ToggleSwitch checked={form.responseRules.hstsEnabled} onChange={(v) => updateResponse("hstsEnabled", v)} />}
                    />
                    <SettingRow
                      title="Markdown for agents"
                      description="Serve a markdown version of your pages to AI crawlers that request it."
                      control={
                        <ToggleSwitch
                          checked={form.responseRules.markdownForAgents}
                          onChange={(v) => updateResponse("markdownForAgents", v)}
                        />
                      }
                    />
                  </>
                )}

                {activeTab === "firewall" && (
                  <>
                    <SettingRow
                      title="Path blocking"
                      info="Covers common targets like /.env, /.git, and admin panels."
                      description="Return a 404 for requests to well-known vulnerability paths, right at the edge."
                      control={<ToggleSwitch checked={form.firewall.pathBlocking} onChange={(v) => updateFirewall("pathBlocking", v)} />}
                    />
                    <SettingRow
                      title="Browser integrity check"
                      description="Screen request headers against known bad signatures and drop suspicious traffic."
                      control={
                        <ToggleSwitch
                          checked={form.firewall.browserIntegrityCheck}
                          onChange={(v) => updateFirewall("browserIntegrityCheck", v)}
                        />
                      }
                    />
                    <SettingRow
                      title="Under attack mode"
                      description="Show every visitor a short verification step before they reach your project. Use during active attacks."
                      control={<ToggleSwitch checked={form.firewall.underAttackMode} onChange={(v) => updateFirewall("underAttackMode", v)} />}
                    />
                  </>
                )}
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
              disabled={!form || loading || saving}
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

function SettingRow({
  title,
  description,
  control,
  info,
}: {
  title: string;
  description: string;
  control: ReactNode;
  info?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b-[0.5px] border-dash-border py-4 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-dash-text-strong">{title}</span>
          {info ? (
            <SimpleTooltip content={info} side="top">
              <span className="flex items-center text-dash-text-faded">
                <Info className="size-3.5" />
              </span>
            </SimpleTooltip>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-dash-text-faded">{description}</p>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}
