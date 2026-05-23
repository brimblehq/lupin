import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Camera, Flag, Layers, Package, Users } from "lucide-react";

type Item = {
  icon: React.ComponentType<{ className?: string }>;
  bold: string;
  rest: string;
};

const items: Item[] = [
  {
    icon: Package,
    bold: "Boot from where you left off —",
    rest: "no more npm install loops",
  },
  {
    icon: Users,
    bold: "Hand a teammate the exact box —",
    rest: "byte for byte, no setup notes",
  },
  {
    icon: Flag,
    bold: "Rewind to a known-good state —",
    rest: "before you touched anything risky",
  },
  {
    icon: Layers,
    bold: "Fan out the same sandbox —",
    rest: "one frozen state, many runners",
  },
];

const KW = "text-[#c694ff]";
const STR = "text-[#a5e3a5]";
const FN = "text-[#7fc8ff]";
const PUNCT = "text-white/55";
const DIM = "text-white/35";
const TXT = "text-white/85";

type Tok = { t: string; c?: string };
type Line = Tok[];

const codeLines: Line[] = [
  [{ t: "// 1. Create a sandbox and set up your environment", c: DIM }],
  [
    { t: "const ", c: KW },
    { t: "sandbox " },
    { t: "= ", c: PUNCT },
    { t: "await ", c: KW },
    { t: "client.sandboxes.", c: FN },
    { t: "createReady", c: FN },
    { t: "({ template: ", c: PUNCT },
    { t: '"node-22"', c: STR },
    { t: " });", c: PUNCT },
  ],
  [
    { t: "await ", c: KW },
    { t: "sandbox.", c: FN },
    { t: "exec", c: FN },
    { t: "({ cmd: ", c: PUNCT },
    { t: '"npm install"', c: STR },
    { t: " });", c: PUNCT },
  ],
  [
    { t: "await ", c: KW },
    { t: "sandbox.", c: FN },
    { t: "exec", c: FN },
    { t: "({ cmd: ", c: PUNCT },
    { t: '"npm run build"', c: STR },
    { t: " });", c: PUNCT },
  ],
  [],
  [{ t: "// 2. Capture the configured state as a snapshot", c: DIM }],
  [
    { t: "const ", c: KW },
    { t: "snap " },
    { t: "= ", c: PUNCT },
    { t: "await ", c: KW },
    { t: "sandbox.snapshots.", c: FN },
    { t: "create", c: FN },
    { t: "({ name: ", c: PUNCT },
    { t: '"ready-to-go"', c: STR },
    { t: " });", c: PUNCT },
  ],
  [
    { t: "console.", c: FN },
    { t: "log", c: FN },
    { t: "(", c: PUNCT },
    { t: '"snapshot ready:"', c: STR },
    { t: ", snap.id);", c: PUNCT },
  ],
  [],
  [{ t: "// 3. Restore into a fresh sandbox", c: DIM }],
  [
    { t: "const ", c: KW },
    { t: "fast " },
    { t: "= ", c: PUNCT },
    { t: "await ", c: KW },
    { t: "client.sandboxes.", c: FN },
    { t: "createReady", c: FN },
    { t: "({ fromSnapshot: snap.id });", c: PUNCT },
  ],
  [],
  [{ t: "// 4. Or fan out — many parallel sandboxes from one snapshot", c: DIM }],
  [
    { t: "const ", c: KW },
    { t: "workers " },
    { t: "= ", c: PUNCT },
    { t: "await ", c: KW },
    { t: "Promise.", c: FN },
    { t: "all", c: FN },
    { t: "([", c: PUNCT },
  ],
  [
    { t: "  client.sandboxes.", c: FN },
    { t: "createReady", c: FN },
    { t: "({ fromSnapshot: snap.id }),", c: PUNCT },
  ],
  [
    { t: "  client.sandboxes.", c: FN },
    { t: "createReady", c: FN },
    { t: "({ fromSnapshot: snap.id }),", c: PUNCT },
  ],
  [
    { t: "  client.sandboxes.", c: FN },
    { t: "createReady", c: FN },
    { t: "({ fromSnapshot: snap.id }),", c: PUNCT },
  ],
  [{ t: "]);", c: PUNCT }],
];

export function SandboxSnapshots() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="bg-brimble-surface px-6 py-[96px] transition-colors duration-300">
      <div ref={ref} className="mx-auto flex max-w-[1120px] flex-col gap-14">
        {/* Centered header */}
        <motion.div
          className="flex flex-col items-center gap-5 text-center"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/55">
            <Camera className="size-3.5" aria-hidden="true" />
            Save state, skip the setup
          </span>
          <h2 className="font-heading text-[56px] font-medium leading-none tracking-[-0.576px] text-brimble-black md:text-[64px]">
            Snapshots
          </h2>
          <p className="max-w-[680px] text-pretty font-body text-[16px] leading-[24px] tracking-[-0.32px] text-brimble-black/60">
            Set a sandbox up exactly how you want it — packages installed, files in place, env wired up — then freeze that moment.
            New sandboxes boot from the frozen state in seconds. Hand one to a teammate, roll one back when something breaks, or fan
            out a hundred copies that all start where the work began.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          {/* Left: feature items */}
          <ul className="flex flex-col gap-6">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.li
                  key={item.bold}
                  className="flex items-start gap-4"
                  initial={{ opacity: 0, y: 16 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    duration: 0.5,
                    delay: 0.15 + i * 0.08,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[rgba(152,157,164,0.3)] bg-brimble-air-gray text-brimble-black/70 dark:border-white/10 dark:bg-[#1a1c1e]">
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <p className="pt-1.5 font-body text-[16px] leading-[22px] tracking-[-0.32px]">
                    <span className="font-medium text-brimble-black">{item.bold}</span>{" "}
                    <span className="text-brimble-black/55">{item.rest}</span>
                  </p>
                </motion.li>
              );
            })}
          </ul>

          {/* Right: code block */}
          <motion.div
            className="w-full overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#1a1c1e] shadow-[var(--shadow-dark-big)]"
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <div className="flex gap-[6.6px]">
                <span className="size-[10px] rounded-full bg-[#ff5f57]" />
                <span className="size-[10px] rounded-full bg-[#febc2e]" />
                <span className="size-[10px] rounded-full bg-[#28c840]" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[1.4px] text-white/40">snapshots.ts</span>
              <span className="size-[10px]" aria-hidden="true" />
            </div>
            <div className="overflow-x-auto px-5 pb-5 pt-4">
              <pre className="font-mono text-[12.5px] leading-[21px] tracking-[-0.02px]">
                <code>
                  {codeLines.map((line, i) => (
                    <span key={i} className="block whitespace-pre">
                      {line.length === 0 ? (
                        <span>&nbsp;</span>
                      ) : (
                        line.map((tok, j) => (
                          <span key={j} className={tok.c ?? TXT}>
                            {tok.t}
                          </span>
                        ))
                      )}
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
