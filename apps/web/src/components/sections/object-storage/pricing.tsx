import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Button } from "@brimble/ui";

const figures = [
  { value: "Free", label: "Egress" },
  { value: "Free", label: "Requests" },
  { value: "$0.032", suffix: "/ GB-month", label: "Storage" },
] as const;

export function ObjectStoragePricing() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="border-t border-[rgba(152,157,164,0.2)] bg-brimble-air-gray px-6 py-[104px] transition-colors duration-300 dark:border-white/5">
      <div ref={ref} className="mx-auto flex max-w-[820px] flex-col items-center gap-8 text-center">
        <motion.span
          className="font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/50"
          initial={{ opacity: 0, y: 8 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          Pricing
        </motion.span>

        <motion.h2
          className="text-balance font-heading text-[40px] font-medium leading-[44px] tracking-[-0.576px] text-brimble-black md:text-[54px] md:leading-[56px]"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          No egress fees. No request fees.
        </motion.h2>

        <motion.p
          className="max-w-[540px] text-pretty font-body text-[17px] leading-[25px] tracking-[-0.32px] text-brimble-black/60"
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          Most clouds meter every download, so your bill grows with traffic you can't control. Brimble doesn't — what you pay tracks the
          data you keep, not how often the world reaches for it.
        </motion.p>

        <motion.div
          className="mt-4 grid w-full max-w-[640px] grid-cols-1 divide-y divide-[rgba(152,157,164,0.25)] rounded-2xl border border-[rgba(152,157,164,0.25)] bg-brimble-surface shadow-[var(--shadow-button)] sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-white/10 dark:border-white/10 dark:bg-[#1a1c1e]"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {figures.map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1.5 px-6 py-8">
              <div className="flex items-baseline gap-1">
                <span className="font-heading text-[40px] font-medium leading-none tracking-[-1.2px] text-brimble-black">{f.value}</span>
                {"suffix" in f && <span className="font-body text-[12px] text-brimble-black/50">{f.suffix}</span>}
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[1.4px] text-brimble-accent-blue">{f.label}</span>
            </div>
          ))}
        </motion.div>

        <motion.p
          className="font-body text-[13px] leading-[18px] text-brimble-black/45"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          Storage is metered hourly and billed as GB-months.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <Button
            asChild
            variant="pill-light"
            size="sm"
            className="transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98]"
          >
            <a href="https://paper.brimble.io/object-storage/overview" target="_blank" rel="noopener noreferrer">
              See full pricing details
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
