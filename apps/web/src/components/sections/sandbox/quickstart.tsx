import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { Check, Copy } from "lucide-react";

type Tab = {
  id: string;
  label: string;
  install: string;
  filename: string;
  language: string;
  source: string;
  highlight: (line: string) => React.ReactNode;
};

function tokenize(line: string, patterns: Array<[RegExp, string]>): React.ReactNode {
  const matches: Array<{ start: number; end: number; cls: string }> = [];
  for (const [re, cls] of patterns) {
    const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = r.exec(line)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (matches.some((x) => start < x.end && end > x.start)) continue;
      matches.push({ start, end, cls });
    }
  }
  matches.sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) out.push(<span key={`p-${i}`}>{line.slice(cursor, m.start)}</span>);
    out.push(
      <span key={`m-${i}`} className={m.cls}>
        {line.slice(m.start, m.end)}
      </span>,
    );
    cursor = m.end;
  });
  if (cursor < line.length) out.push(<span key="tail">{line.slice(cursor)}</span>);
  return out;
}

const TS_PATTERNS: Array<[RegExp, string]> = [
  [/\/\/.*$/g, "text-white/30"],
  [/"[^"]*"|'[^']*'/g, "text-[#a5e3a5]"],
  [/\b(import|from|const|let|await|async|new|return|export|function|if|else)\b/g, "text-[#c694ff]"],
  [/\b(Sandbox)\b/g, "text-[#ffd479]"],
  [/\b(createReady|exec|runCode|putFile|getFile|create|destroy|snapshots|sandboxes)\b/g, "text-[#7fc8ff]"],
];

const PY_PATTERNS: Array<[RegExp, string]> = [
  [/#.*$/g, "text-white/30"],
  [/"[^"]*"|'[^']*'/g, "text-[#a5e3a5]"],
  [/\b(import|from|with|as|await|async|def|return|if|else|for|in)\b/g, "text-[#c694ff]"],
  [/\b(Sandbox)\b/g, "text-[#ffd479]"],
  [/\b(create_ready|exec|run_code|put_file|get_file|create|destroy|snapshots|sandboxes)\b/g, "text-[#7fc8ff]"],
];

const SH_PATTERNS: Array<[RegExp, string]> = [
  [/#.*$/g, "text-white/30"],
  [/"[^"]*"|'[^']*'/g, "text-[#a5e3a5]"],
  [/\b(curl|export|jq|cat)\b/g, "text-[#c694ff]"],
  [/-[A-Za-z]+|--[A-Za-z-]+/g, "text-[#ffd479]"],
  [/https?:\/\/[^\s'"]+/g, "text-[#7fc8ff]"],
];

const tabs: Tab[] = [
  {
    id: "ts",
    label: "TypeScript",
    install: "npm install @brimble/sandbox",
    filename: "create-and-run.ts",
    language: "ts",
    source: `import { Sandbox } from "@brimble/sandbox";

const client = new Sandbox();

// 1. create a sandbox from a template
const sandbox = await client.sandboxes.createReady({
  template: "python-3.12",
  region: "auto",
  name: "agent-session",
});

// 2. run untrusted code inside it
const result = await sandbox.runCode({
  language: "python",
  code: "print(sum(range(10**6)))",
});

console.log(result.stdout); // "499999500000\\n"

// 3. snapshot the filesystem, then clean up
await sandbox.snapshots.create({ name: "agent-ready" });
await sandbox.destroy();`,
    highlight: (line) => tokenize(line, TS_PATTERNS),
  },
  {
    id: "py",
    label: "Python",
    install: "pip install brimble-sandbox",
    filename: "create_and_run.py",
    language: "py",
    source: `from brimble_sandbox import Sandbox

client = Sandbox()

# 1. create a sandbox from a template
sandbox = client.sandboxes.create_ready(
    template="python-3.12",
    region="auto",
    name="agent-session",
)

# 2. run untrusted code inside it
result = sandbox.run_code(
    language="python",
    code="print(sum(range(10**6)))",
)

print(result.stdout)  # "499999500000\\n"

# 3. snapshot the filesystem, then clean up
sandbox.snapshots.create(name="agent-ready")
sandbox.destroy()`,
    highlight: (line) => tokenize(line, PY_PATTERNS),
  },
  {
    id: "sh",
    label: "cURL",
    install: 'export BRIMBLE_SANDBOX_KEY="sk_..."',
    filename: "create-and-run.sh",
    language: "sh",
    source: `# 1. create a sandbox
SANDBOX_ID=$(curl -sX POST https://sandbox.brimble.io/sandboxes \\
  -H "x-brimble-key: $BRIMBLE_SANDBOX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "template": "python-3.12", "region": "auto" }' \\
  | jq -r .id)

# 2. run code inside it
curl -sX POST "https://sandbox.brimble.io/sandboxes/$SANDBOX_ID/run-code" \\
  -H "x-brimble-key: $BRIMBLE_SANDBOX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "language": "python", "code": "print(sum(range(10**6)))" }'

# 3. clean up
curl -sX DELETE "https://sandbox.brimble.io/sandboxes/$SANDBOX_ID" \\
  -H "x-brimble-key: $BRIMBLE_SANDBOX_KEY"`,
    highlight: (line) => tokenize(line, SH_PATTERNS),
  },
];

export function SandboxQuickstart() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [active, setActive] = useState(tabs[0].id);
  const [copied, setCopied] = useState(false);

  const tab = tabs.find((t) => t.id === active) ?? tabs[0];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tab.source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  return (
    <section className="bg-brimble-surface px-6 py-[88px] transition-colors duration-300">
      <div ref={ref} className="mx-auto flex max-w-[1120px] flex-col gap-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <motion.div
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/50">Quickstart</span>
            <h2 className="text-balance font-heading text-[40px] font-medium leading-[46px] tracking-[-0.576px] text-brimble-black md:text-[44px] md:leading-[50px]">
              Four lines to create one, two to run code in it.
            </h2>
            <p className="max-w-[460px] text-pretty font-body text-base leading-[22px] tracking-[-0.32px] text-brimble-black/60">
              Real SDK, real API. First-party clients for TypeScript, Python, and Go — or just call the REST endpoints from anywhere. Pick a
              template, get a ready sandbox, and start executing.
            </p>
            <div className="mt-2 flex flex-col gap-2 rounded-xl border border-[rgba(152,157,164,0.25)] bg-brimble-air-gray p-4 dark:border-white/10 dark:bg-[#1a1c1e]">
              <span className="font-mono text-[10px] uppercase tracking-[1.4px] text-brimble-black/45">Install</span>
              <code className="font-mono text-[13px] leading-snug text-brimble-black">{tab.install}</code>
            </div>
          </motion.div>

          <motion.div
            className="w-full overflow-hidden rounded-[14px] bg-[#1a1c1e] shadow-[var(--shadow-dark-big)]"
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Tab bar */}
            <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2">
              <div className="flex gap-1" role="tablist" aria-label="Quickstart languages">
                {tabs.map((t) => {
                  const isActive = t.id === active;
                  return (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActive(t.id)}
                      className={`relative rounded-[6px] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[1.2px] transition-colors duration-150 ${
                        isActive ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 pr-1 font-mono text-[10px] uppercase tracking-[1.4px] text-white/35">
                <span className="hidden sm:inline">{tab.filename}</span>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-white/55 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white"
                  aria-label="Copy code"
                >
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Code body */}
            <div className="overflow-x-auto px-4 pb-6 pt-4">
              <pre className="font-mono text-[12.5px] leading-[21px] tracking-[-0.02px] text-white/80">
                <code>
                  {tab.source.split("\n").map((line, i) => (
                    <span key={i} className="block whitespace-pre">
                      <span className="mr-3 inline-block w-5 select-none text-right text-white/25">{i + 1}</span>
                      {line.length ? tab.highlight(line) : <span>&nbsp;</span>}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
