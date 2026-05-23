import { useRef } from "react";
import { motion, useInView } from "motion/react";

type CardProps = {
  className?: string;
  eyebrow: string;
  title: string;
  body: string;
  children?: React.ReactNode;
  delay?: number;
};

function Card({ className = "", eyebrow, title, body, children, delay = 0 }: CardProps) {
  return (
    <motion.article
      className={`flex flex-col gap-4 rounded-2xl border border-[rgba(152,157,164,0.25)] bg-brimble-surface p-6 shadow-[var(--shadow-button)] dark:border-white/10 dark:bg-[#1a1c1e] ${className}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[1.4px] text-brimble-black/45">{eyebrow}</span>
      </div>
      <h3 className="text-balance font-body text-[19px] font-medium leading-[24px] tracking-[-0.32px] text-brimble-black">{title}</h3>
      <p className="text-pretty font-body text-[14.5px] leading-[21px] tracking-[-0.2px] text-brimble-black/60">{body}</p>
      {children && <div className="pt-1">{children}</div>}
    </motion.article>
  );
}

function ArchPreview() {
  return (
    <svg viewBox="0 0 380 180" className="h-auto w-full max-w-[460px]" aria-hidden="true">
      <defs>
        <linearGradient id="arch-host" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" className="[stop-color:rgba(152,157,164,0.18)]" />
          <stop offset="100%" className="[stop-color:rgba(152,157,164,0.04)]" />
        </linearGradient>
      </defs>

      {/* host pool */}
      <rect x="8" y="14" width="364" height="150" rx="10" fill="url(#arch-host)" className="stroke-brimble-black/15" />
      <text x="18" y="32" className="fill-brimble-black/45 font-mono text-[10px] uppercase tracking-[1.4px]">
        sandbox pool · iad-1
      </text>

      {/* nodes */}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${24 + i * 116}, 50)`}>
          <rect width="100" height="98" rx="6" className="fill-brimble-surface stroke-brimble-black/20 dark:fill-[#222528]" />
          <text x="10" y="18" className="fill-brimble-black/50 font-mono text-[9px] uppercase tracking-[1.2px]">
            node {i + 1}
          </text>

          {/* isolation wrapper */}
          <rect
            x="10"
            y="26"
            width="80"
            height="58"
            rx="4"
            className="fill-brimble-accent-blue/10 stroke-brimble-accent-blue/40"
            strokeDasharray="3 3"
          />
          <text x="16" y="40" className="fill-brimble-accent-blue font-mono text-[8px] uppercase tracking-[1.2px]">
            isolated
          </text>

          {/* container */}
          <rect x="18" y="46" width="64" height="32" rx="3" className="fill-brimble-black/8 stroke-brimble-black/30" />
          <text x="50" y="63" textAnchor="middle" className="fill-brimble-black/70 font-mono text-[9px]">
            sandbox
          </text>
          <circle cx="76" cy="55" r="2.5" className={i === 1 ? "fill-[#28c840]" : "fill-brimble-black/30"} />
        </g>
      ))}

      {/* arrows */}
      <path d="M 110 99 L 144 99" className="stroke-brimble-black/30" strokeWidth="1" strokeDasharray="2 2" />
      <path d="M 226 99 L 260 99" className="stroke-brimble-black/30" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}

function CodeMicro({ lines }: { lines: Array<{ t: string; c?: string }> }) {
  return (
    <pre className="overflow-hidden rounded-md bg-[#1a1c1e] px-3 py-2.5 font-mono text-[11px] leading-[18px] text-white/80">
      <code>
        {lines.map((l, i) => (
          <span key={i} className={`block whitespace-pre ${l.c ?? ""}`}>
            {l.t}
          </span>
        ))}
      </code>
    </pre>
  );
}

function PauseMeter() {
  return (
    <div className="flex items-center gap-3 rounded-md bg-brimble-air-gray px-3 py-2.5 dark:bg-[#222528]">
      <span className="size-2 rounded-full bg-[#febc2e]" />
      <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-brimble-black/55">paused</span>
      <span className="ml-auto font-mono text-[11px] text-brimble-black/45">$0.00 / hr</span>
    </div>
  );
}

function NetGraph() {
  return (
    <svg viewBox="0 0 220 64" className="h-14 w-full" aria-hidden="true">
      <rect x="6" y="10" width="60" height="44" rx="6" className="fill-brimble-black/5 stroke-brimble-black/20" />
      <text x="36" y="36" textAnchor="middle" className="fill-brimble-black/65 font-mono text-[9px]">
        sandbox
      </text>
      <path d="M 72 32 L 122 32" className="stroke-[#ff5f57]" strokeWidth="1.5" strokeDasharray="3 3" />
      <path d="M 116 26 L 124 32 L 116 38" className="fill-none stroke-[#ff5f57]" strokeWidth="1.5" />
      <rect x="130" y="10" width="84" height="44" rx="6" className="fill-brimble-black/5 stroke-brimble-black/20" />
      <text x="172" y="29" textAnchor="middle" className="fill-brimble-black/55 font-mono text-[9px]">
        outbound
      </text>
      <text x="172" y="42" textAnchor="middle" className="fill-[#ff5f57]/90 font-mono text-[9px] uppercase tracking-[1px]">
        blocked
      </text>
    </svg>
  );
}

export function SandboxFeatures() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="border-t border-[rgba(152,157,164,0.2)] bg-brimble-air-gray px-6 py-[88px] transition-colors duration-300 dark:border-white/5">
      <div ref={ref} className="mx-auto flex max-w-[1120px] flex-col gap-12">
        <motion.div
          className="flex max-w-[680px] flex-col gap-3"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/50">What's in the box</span>
          <h2 className="text-balance font-heading text-[40px] font-medium leading-[46px] tracking-[-0.576px] text-brimble-black md:text-[44px] md:leading-[50px]">
            Seven things you'd otherwise have to build yourself.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          {/* Big card — architecture preview */}
          <Card
            className="md:col-span-4 md:row-span-2"
            eyebrow="Isolation"
            title="Isolated by default, on a dedicated host pool."
            body="Every sandbox runs inside its own walled-off layer that sits between the code and the host — your machine and your other apps never see what happens inside. Sandboxes live on a host pool that never runs production apps, so a noisy one can't slow anything else down."
            delay={0.05}
          >
            <div className="mt-2 flex justify-center rounded-xl bg-brimble-surface p-4 dark:bg-[#222528]">
              <ArchPreview />
            </div>
          </Card>

          {/* Medium card — pause/resume */}
          <Card
            className="md:col-span-2"
            eyebrow="Lifecycle"
            title="Pause when idle, resume on demand."
            body="Step away from a long session and compute billing stops. Resume tomorrow and pick up exactly where you left off."
            delay={0.1}
          >
            <PauseMeter />
          </Card>

          {/* Medium card — snapshots */}
          <Card
            className="md:col-span-2"
            eyebrow="Snapshots"
            title="Save state, clone it later."
            body="Capture a sandbox's filesystem, then restore into a fresh sandbox. Hand off a setup, or skip configuration next time."
            delay={0.15}
          >
            <CodeMicro
              lines={[
                { t: "await sandbox.snapshots.create({", c: "text-white/80" },
                { t: '  name: "ready-to-go"', c: "text-[#a5e3a5]" },
                { t: "});", c: "text-white/80" },
              ]}
            />
          </Card>

          {/* Medium card — network */}
          <Card
            className="md:col-span-3"
            eyebrow="Networking"
            title="Block outbound traffic with one flag."
            body="Sandboxes have normal network access by default. Pass blockOutbound: true at create time and the CNI policy denies all egress — useful when you're running something you don't fully trust."
            delay={0.05}
          >
            <NetGraph />
          </Card>

          {/* Medium card — volumes */}
          <Card
            className="md:col-span-3"
            eyebrow="Storage"
            title="Throwaway by default, persistent when you want."
            body="Most sandboxes are throwaway and wipe on destroy. Attach a 10–50 GB volume and your files outlive the sandbox — then mount that same volume on a new one whenever you need it back."
            delay={0.1}
          >
            <div className="flex gap-2 rounded-md bg-brimble-surface px-3 py-2.5 font-mono text-[11px] dark:bg-[#222528]">
              <span className="text-brimble-black/55">vol_4f9a</span>
              <span className="text-brimble-black/30">·</span>
              <span className="text-brimble-black/70">25 GB</span>
              <span className="ml-auto text-[#28c840]">attached</span>
            </div>
          </Card>

          {/* Small — templates */}
          <Card
            className="md:col-span-2"
            eyebrow="Runtimes"
            title="Nine templates, pre-warmed."
            body="Python, Node, Bun, Deno, Ubuntu — plus Claude Code, Codex, OpenCode, and Droid agent presets."
            delay={0.15}
          />

          {/* Small — SDKs */}
          <Card
            className="md:col-span-2"
            eyebrow="SDKs"
            title="TS, Python, Go — or REST."
            body="Same API surface across all three first-party SDKs. Or call the REST endpoints from any language."
            delay={0.2}
          />

          {/* Small — files */}
          <Card
            className="md:col-span-2"
            eyebrow="Filesystem"
            title="Read and write files like you would locally."
            body="putFile and getFile move bytes in and out. Pair with snapshots to ship environments to teammates."
            delay={0.25}
          />
        </div>
      </div>
    </section>
  );
}
