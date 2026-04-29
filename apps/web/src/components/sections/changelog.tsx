import { Fragment, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useInView } from "motion/react";
import { ArrowRight } from "lucide-react";
import { siteConfig } from "@/config/site";
import type { ChangelogEntry, ChangelogType } from "@/server/changelog/actions";

const TYPE_BADGE_CLASS: Record<ChangelogType, string> = {
  Feature: "bg-[#e6f0ff] text-[#006fff] dark:bg-[#006fff]/15 dark:text-[#3b8eff]",
  Improvement: "bg-brimble-light-gray text-brimble-black/70 dark:bg-white/10 dark:text-brimble-black/70",
  Fix: "bg-[#fff4e6] text-[#b35900] dark:bg-[#b35900]/15 dark:text-[#ffa54d]",
};

const BADGE_BASE =
  "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[1.2px]";

export function Changelog({ entries }: { entries: ChangelogEntry[] }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  if (entries.length === 0) return null;

  const recent = entries.slice(0, 3);

  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 py-[72px]">
      <div ref={ref} className="mx-auto flex max-w-[720px] flex-col gap-10">
        {/* Heading */}
        <div className="flex flex-col gap-3">
          <motion.span
            className="font-mono text-xs uppercase tracking-[1.2px] text-brimble-black/50"
            initial={{ opacity: 0, y: 12 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {siteConfig.changelog.eyebrow}
          </motion.span>
          <motion.h2
            className="font-heading text-[40px] font-medium leading-[44px] tracking-[-0.576px] text-brimble-black"
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            {siteConfig.changelog.heading}
          </motion.h2>
          <motion.p
            className="max-w-[480px] font-body text-base leading-[21px] tracking-[-0.32px] text-brimble-black/60"
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            {siteConfig.changelog.description}
          </motion.p>
        </div>

        {/* Entries */}
        <div className="flex flex-col">
          {recent.map((entry, i) => (
            <Fragment key={entry.slug}>
              {i > 0 && <div className="h-px w-full bg-brimble-black/10 dark:bg-white/10" />}
              <motion.div
                className="flex flex-col gap-2 py-6"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <time
                    dateTime={entry.dateISO}
                    className="font-mono text-xs uppercase tracking-[1.2px] text-brimble-black/50"
                  >
                    {entry.date}
                  </time>
                  <span className={`${BADGE_BASE} ${TYPE_BADGE_CLASS[entry.type]}`}>{entry.type}</span>
                </div>
                <Link
                  to="/changelog"
                  hash={entry.slug}
                  className="font-body text-base font-medium text-brimble-black hover:underline"
                >
                  {entry.title}
                </Link>
                <p className="font-body text-sm leading-[1.6] text-brimble-black/60">{entry.summary}</p>
              </motion.div>
            </Fragment>
          ))}
        </div>

        {/* View all */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.15 + recent.length * 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            to="/changelog"
            className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-[#006fff] hover:underline"
          >
            {siteConfig.changelog.viewAllCta}
            <ArrowRight className="size-3.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
