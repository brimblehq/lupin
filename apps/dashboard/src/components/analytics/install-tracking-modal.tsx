import { Fragment, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Modal, ModalHeader } from "@/components/shared/modal";
import { hapticToast as toast } from "@/utils/haptic-toast";
import { useHaptics } from "@/hooks/use-haptics";
import type { AnalyticsSnippets, AnalyticsSnippet, AnalyticsSnippetLanguage } from "@/backend/analytics";

const HIGHLIGHT_RE = new RegExp(
  [
    "(?<comment>//[^\\n]*|/\\*[\\s\\S]*?\\*/|<!--[\\s\\S]*?-->)",
    "(?<string>\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)",
    "(?<tag></?[A-Za-z][\\w-]*|/?>)",
    "(?<attr>[A-Za-z][\\w-]*(?==))",
    "(?<keyword>\\b(?:import|from|export|default|function|const|let|var|return|if|else|for|while|new|null|true|false|undefined|typeof|async|await|class|extends|this|super|try|catch|finally|throw|setup|onMounted)\\b)",
    "(?<number>\\b\\d+\\b)",
    "(?<ident>[A-Za-z_$][\\w$]*)",
  ].join("|"),
  "g",
);

const TOKEN_CLASS: Record<string, string> = {
  comment: "italic text-dash-text-extra-faded",
  string: "text-[#0e7c66] dark:text-[#5eead4]",
  tag: "text-[#b4366b] dark:text-[#f9a8d4]",
  attr: "text-[#9a5b00] dark:text-[#fcd34d]",
  keyword: "text-[#7c3aed] dark:text-[#c4b5fd]",
  number: "text-[#9a5b00] dark:text-[#fcd34d]",
  ident: "",
};

function formatSnippet(code: string): string {
  return code.replace(/<\/script>\s*<script/g, "</script>\n\n<script");
}

function highlight(code: string) {
  const out: { text: string; cls: string }[] = [];
  let last = 0;
  for (const m of code.matchAll(HIGHLIGHT_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ text: code.slice(last, start), cls: "" });
    const type = Object.keys(m.groups ?? {}).find((k) => m.groups?.[k] != null) ?? "";
    out.push({ text: m[0], cls: TOKEN_CLASS[type] ?? "" });
    last = start + m[0].length;
  }
  if (last < code.length) out.push({ text: code.slice(last), cls: "" });
  return out;
}

const FRAMEWORK_ORDER: (keyof AnalyticsSnippets)[] = ["html", "react", "nextjsApp", "nextjsPages", "vue", "nuxt", "svelte"];

function fallbackSnippets(rawSnippet: string | undefined, siteId: string): AnalyticsSnippets {
  const baseCode = rawSnippet ?? `<script async defer\n  src="https://cdn.brimble.io/analytics.js"\n  data-site-id="${siteId}"></script>`;
  const make = (label: string, language: AnalyticsSnippetLanguage, file: string, instructions: string, code: string): AnalyticsSnippet => ({
    label,
    language,
    file,
    instructions,
    code,
  });

  return {
    html: make("HTML", "html", "index.html", "Paste this into the <head> of your index.html.", baseCode),
    react: make(
      "React (Vite / CRA)",
      "tsx",
      "src/main.tsx",
      "Add this script tag to public/index.html or render it from your root component.",
      baseCode,
    ),
    nextjsApp: make(
      "Next.js (App Router)",
      "tsx",
      "app/layout.tsx",
      "Drop this into your root <head>. Don't use next/script — Brimble Analytics needs to load synchronously.",
      baseCode,
    ),
    nextjsPages: make(
      "Next.js (Pages Router)",
      "tsx",
      "pages/_document.tsx",
      "Add this inside the <Head /> component of your custom _document.",
      baseCode,
    ),
    vue: make("Vue (Vite)", "html", "index.html", "Paste this into the <head> of your index.html.", baseCode),
    nuxt: make("Nuxt", "ts", "nuxt.config.ts", "Add it via app.head.script in nuxt.config.ts.", baseCode),
    svelte: make("Svelte / SvelteKit", "html", "src/app.html", "Paste this into the <head> of src/app.html.", baseCode),
  };
}

export function InstallTrackingModal({
  open,
  onOpenChange,
  siteId,
  snippets,
  serverSnippet,
  onEnable,
  enabling,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  /** Full snippets object from the analytics API. Preferred. */
  snippets?: AnalyticsSnippets;
  /** Legacy single-string snippet. Used as a fallback when `snippets` isn't available. */
  serverSnippet?: string;
  onEnable?: () => void | Promise<void>;
  enabling?: boolean;
}) {
  const haptics = useHaptics();
  const resolvedSnippets = snippets ?? fallbackSnippets(serverSnippet, siteId);
  const [activeKey, setActiveKey] = useState<keyof AnalyticsSnippets>("html");
  const [copied, setCopied] = useState(false);
  const [siteIdCopied, setSiteIdCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setActiveKey("html");
      setCopied(false);
      setSiteIdCopied(false);
    }
  }, [open]);

  const active = resolvedSnippets[activeKey];
  const code = formatSnippet(active.code);

  async function handleCopySnippet() {
    try {
      await navigator.clipboard.writeText(code);
      haptics.success();
      setCopied(true);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      haptics.error();
      toast.error("Could not copy to clipboard");
    }
  }

  async function handleCopySiteId() {
    try {
      await navigator.clipboard.writeText(siteId);
      haptics.light();
      setSiteIdCopied(true);
      window.setTimeout(() => setSiteIdCopied(false), 1500);
    } catch {
      haptics.error();
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={620}>
      <ModalHeader title="Install tracking" description="Drop this snippet into your site to start collecting analytics." />
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-[1px] text-dash-text-faded">Site ID</span>
          <div className="flex items-center gap-2 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-3 py-2">
            <code className="flex-1 truncate font-mono text-xs text-dash-text-body">{siteId}</code>
            <button
              type="button"
              onClick={() => {
                void handleCopySiteId();
              }}
              className="shrink-0 text-dash-text-faded transition-colors hover:text-dash-text-strong"
              aria-label="Copy site ID"
            >
              {siteIdCopied ? <Check className="size-3.5 text-[#22c55e]" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-[4px] border-[0.5px] border-dash-border p-0.5">
          {FRAMEWORK_ORDER.map((k) => {
            const opt = resolvedSnippets[k];
            const isActive = k === activeKey;
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  if (!isActive) haptics.selection();
                  setActiveKey(k);
                }}
                className={`shrink-0 whitespace-nowrap rounded-[3px] px-3 py-1 text-xs font-medium transition-colors ${
                  isActive ? "bg-dash-bg-elevated text-dash-text-strong" : "text-dash-text-faded hover:text-dash-text-body"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-start gap-2 rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated px-3 py-2.5">
          <div className="flex flex-1 flex-col gap-1">
            <code className="font-mono text-[11px] text-dash-text-strong">{active.file}</code>
            <p className="text-[11px] font-light leading-[1.5] text-dash-text-faded">{active.instructions}</p>
          </div>
        </div>

        <div className="relative">
          <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap break-words rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg-elevated p-4 pr-14 font-mono text-[11px] leading-[1.7] text-dash-text-body">
            <code>
              {highlight(code).map((tok, i) => (
                <Fragment key={i}>{tok.cls ? <span className={tok.cls}>{tok.text}</span> : tok.text}</Fragment>
              ))}
            </code>
          </pre>
          <button
            type="button"
            onClick={() => {
              void handleCopySnippet();
            }}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[3px] border-[0.5px] border-dash-border bg-dash-bg px-2 py-1 text-[11px] font-medium text-dash-text-faded transition-colors hover:text-dash-text-strong"
          >
            {copied ? (
              <>
                <Check className="size-3 text-[#22c55e]" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3" />
                Copy
              </>
            )}
          </button>
        </div>

        {!snippets && !serverSnippet && onEnable && (
          <button
            type="button"
            disabled={enabling}
            onClick={() => void onEnable()}
            className="flex h-10 items-center justify-center rounded-[4px] border border-[#232931] bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32] px-4 text-sm font-medium text-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {enabling ? "Enabling..." : "Enable analytics for this project"}
          </button>
        )}
      </div>
    </Modal>
  );
}
