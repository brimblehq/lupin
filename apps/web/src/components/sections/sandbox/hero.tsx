import { motion } from "motion/react";
import { Button } from "@brimble/ui";
import arrowRight from "@/assets/icons/arrow-right.svg";

const KEYWORD = "text-[#c694ff]";
const STRING = "text-[#a5e3a5]";
const FN = "text-[#7fc8ff]";
const PUNCT = "text-white/55";
const DIM = "text-white/45";
const TEXT = "text-white/80";
const GREEN = "text-[#28c840]";
const ORANGE = "text-[#ff9b01]";

type Tok = { t: string; c?: string };
type Step = {
  prompt: Tok[];
  output?: Tok[][];
  elapsedMs: number;
};

const steps: Step[] = [
  {
    prompt: [
      { t: "const ", c: KEYWORD },
      { t: "sandbox " },
      { t: "= ", c: PUNCT },
      { t: "await ", c: KEYWORD },
      { t: "client.sandboxes.", c: FN },
      { t: "createReady", c: FN },
      { t: "({ template: ", c: PUNCT },
      { t: '"python-3.12"', c: STRING },
      { t: " });", c: PUNCT },
    ],
    output: [
      [
        { t: "→ sandbox ", c: DIM },
        { t: "sbx_a1b2c3d4", c: TEXT },
        { t: "  ", c: DIM },
        { t: "ready", c: GREEN },
        { t: "  ", c: DIM },
        { t: "iad-1 · 3.42s", c: DIM },
      ],
    ],
    elapsedMs: 3420,
  },
  {
    prompt: [
      { t: "await ", c: KEYWORD },
      { t: "sandbox.", c: FN },
      { t: "exec", c: FN },
      { t: "({ cmd: ", c: PUNCT },
      { t: '"pip install anthropic"', c: STRING },
      { t: " });", c: PUNCT },
    ],
    output: [
      [{ t: "Successfully installed anthropic-0.39.0", c: TEXT }],
      [
        { t: "→ ", c: DIM },
        { t: "exit 0", c: GREEN },
        { t: "  ", c: DIM },
        { t: "2.14s", c: DIM },
      ],
    ],
    elapsedMs: 2140,
  },
  {
    prompt: [
      { t: "await ", c: KEYWORD },
      { t: "sandbox.", c: FN },
      { t: "runCode", c: FN },
      { t: "({ language: ", c: PUNCT },
      { t: '"python"', c: STRING },
      { t: ", code: ", c: PUNCT },
      { t: '"print(sum(range(10**6)))"', c: STRING },
      { t: " });", c: PUNCT },
    ],
    output: [
      [{ t: "499999500000", c: TEXT }],
      [
        { t: "→ ", c: DIM },
        { t: "exit 0", c: GREEN },
        { t: "  ", c: DIM },
        { t: "0.18s", c: DIM },
      ],
    ],
    elapsedMs: 180,
  },
  {
    prompt: [
      { t: "await ", c: KEYWORD },
      { t: "sandbox.snapshots.", c: FN },
      { t: "create", c: FN },
      { t: "({ name: ", c: PUNCT },
      { t: '"agent-ready"', c: STRING },
      { t: " });", c: PUNCT },
    ],
    output: [
      [
        { t: "→ snapshot ", c: DIM },
        { t: "snap_e5f6g7", c: TEXT },
        { t: "  ", c: DIM },
        { t: "creating", c: ORANGE },
        { t: " → ", c: DIM },
        { t: "ready", c: GREEN },
        { t: "  ", c: DIM },
        { t: "1.6s", c: DIM },
      ],
    ],
    elapsedMs: 1600,
  },
];

const PROMPT_PREFIX = "› ";

function lineKey(step: number, line: number) {
  return `${step}-${line}`;
}

export function SandboxHero() {
  return (
    <section className="bg-brimble-surface px-6 pb-12 pt-16 transition-colors duration-300">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-12">
        {/* Copy block */}
        <div className="flex max-w-[720px] flex-col gap-6">
          <motion.span
            className="font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/50"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            Brimble Sandboxes
          </motion.span>

          <motion.h1
            className="text-balance font-heading text-[44px] font-medium leading-[50px] tracking-[-0.576px] text-brimble-black md:text-[52px] md:leading-[58px]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            A throwaway computer in the cloud, ready in seconds.
          </motion.h1>

          <motion.p
            className="max-w-[520px] text-pretty font-body text-base leading-[22px] tracking-[-0.32px] text-black/60 dark:text-white/60"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            Spin up an isolated environment with one API call. Run AI-generated code, untrusted scripts, or per-user workspaces — then
            pause, snapshot, or destroy. Built for real isolation and real speed, without sharing a kernel with your laptop.
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center gap-2 pt-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Button
              asChild
              variant="pill"
              size="sm"
              className="gap-2 transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98]"
            >
              <a href="https://app.brimble.io" target="_blank" rel="noopener noreferrer">
                Start building
                <img src={arrowRight} alt="" className="size-3 dark:brightness-0" />
              </a>
            </Button>
            <Button
              asChild
              variant="pill-light"
              size="sm"
              className="transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98]"
            >
              <a href="https://paper.brimble.io/sandboxes/overview" target="_blank" rel="noopener noreferrer">
                Read the docs
              </a>
            </Button>
          </motion.div>

        </div>

        {/* Meta row — spans full width */}
        <motion.dl
          className="grid grid-cols-1 gap-6 border-t border-[rgba(152,157,164,0.25)] pt-6 sm:grid-cols-3 dark:border-white/10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[10px] uppercase tracking-[1.2px] text-brimble-black/45">Isolation</dt>
            <dd className="font-body text-sm font-medium leading-tight text-brimble-black">Kernel-level isolation</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[10px] uppercase tracking-[1.2px] text-brimble-black/45">Runtimes</dt>
            <dd className="font-body text-sm font-medium leading-tight text-brimble-black">Node · Python · Bun · Deno</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[10px] uppercase tracking-[1.2px] text-brimble-black/45">SDKs</dt>
            <dd className="font-body text-sm font-medium leading-tight text-brimble-black">TypeScript · Python · Go</dd>
          </div>
        </motion.dl>

        {/* Animated terminal — spans full width */}
        <motion.div
          className="w-full overflow-hidden rounded-[14px] bg-[#1a1c1e] shadow-[var(--shadow-dark-big)]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative h-[34px] bg-[#1a1c1e] px-3 pt-2.5">
            <div className="flex items-center justify-between">
              <div className="flex gap-[6.6px]">
                <span className="size-[10px] rounded-full bg-[#ff5f57]" />
                <span className="size-[10px] rounded-full bg-[#febc2e]" />
                <span className="size-[10px] rounded-full bg-[#28c840]" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[1.4px] text-white/35">sandbox · live</span>
              <span className="size-[10px]" aria-hidden="true" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/[0.06]" />
          </div>

          <div className="min-h-[420px] px-4 pb-5 pt-4">
            <pre className="font-mono text-[12.5px] leading-[20px] tracking-[-0.02px]">
              <code>
                <span className="block whitespace-pre text-white/30">// quickstart.ts</span>
                {steps.map((step, i) => {
                  const baseDelay = 0.6 + i * 0.95;
                  return (
                    <span key={i}>
                      <motion.span
                        className="block whitespace-pre"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.25, delay: baseDelay, ease: "linear" }}
                      >
                        <span className="text-white/40">{PROMPT_PREFIX}</span>
                        {step.prompt.map((tok, j) => (
                          <span key={j} className={tok.c ?? TEXT}>
                            {tok.t}
                          </span>
                        ))}
                      </motion.span>
                      {step.output?.map((line, k) => (
                        <motion.span
                          key={lineKey(i, k)}
                          className="block whitespace-pre"
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: baseDelay + 0.35 + k * 0.18,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                        >
                          {line.map((tok, j) => (
                            <span key={j} className={tok.c ?? TEXT}>
                              {tok.t}
                            </span>
                          ))}
                        </motion.span>
                      ))}
                      <span className="block whitespace-pre">&nbsp;</span>
                    </span>
                  );
                })}

                <motion.span
                  className="inline-block h-[14px] w-[7px] translate-y-[2px] rounded-[1px] bg-white/55"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0, 0] }}
                  transition={{
                    delay: 0.6 + steps.length * 0.95,
                    duration: 1,
                    repeat: Infinity,
                    times: [0, 0.01, 0.5, 0.51, 1],
                    ease: "linear",
                  }}
                />
              </code>
            </pre>
          </div>

          {/* Footer bar */}
          <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#161819] px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[1.2px] text-white/40">
            <span>
              <span className="text-[#28c840]">●</span> 4 ops · all green
            </span>
            <span className="hidden sm:inline">python-3.12 · iad-1</span>
            <span>
              total <span className="text-white/65">{(steps.reduce((s, x) => s + x.elapsedMs, 0) / 1000).toFixed(2)}s</span>
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
