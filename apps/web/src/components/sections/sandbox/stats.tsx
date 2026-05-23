import { useRef } from "react";
import { motion, useInView } from "motion/react";

const stats = [
  {
    value: "~3.5s",
    unit: "to ready",
    label: "Cold start",
    note: "Create-to-ready in a few seconds, not minutes. Schedule, pull, isolate, attach network.",
  },
  {
    value: "9",
    unit: "templates",
    label: "Runtimes & agents",
    note: "Five language runtimes plus four pre-installed AI coding agent presets.",
  },
  {
    value: "3",
    unit: "first-party",
    label: "SDKs",
    note: "TypeScript, Python, and Go — identical surface area across all three.",
  },
  {
    value: "50 GB",
    unit: "max volume",
    label: "Persistent storage",
    note: "Attach a CSI-backed volume from 10 to 50 GB per sandbox; outlives the box.",
  },
] as const;

export function SandboxStats() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="border-t border-[rgba(152,157,164,0.2)] bg-brimble-air-gray px-6 py-[72px] transition-colors duration-300 dark:border-white/5">
      <div ref={ref} className="mx-auto flex max-w-[1120px] flex-col gap-10">
        <motion.div
          className="flex max-w-[680px] flex-col gap-3"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/50">Numbers that matter</span>
        </motion.div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              className="flex flex-col gap-2 border-l border-[rgba(152,157,164,0.3)] pl-5 dark:border-white/10"
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-baseline gap-1">
                <span className="font-heading text-[44px] font-medium leading-none tracking-[-1.6px] text-brimble-black">{s.value}</span>
                <span className="font-body text-[12px] text-brimble-black/50">{s.unit}</span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[1.4px] text-brimble-accent-blue">{s.label}</span>
              <p className="text-pretty font-body text-[13px] leading-[18px] text-brimble-black/55">{s.note}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
