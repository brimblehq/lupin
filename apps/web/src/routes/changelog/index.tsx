import { Fragment, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, useInView } from "motion/react";
import { buildSeoHead } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { Navbar } from "@/components/layout/navbar";
import { MarkdownContent } from "@/components/markdown-content";
import { Cta } from "@/components/sections/cta";
import { listChangelogServerFn, type ChangelogEntry, type ChangelogType } from "@/server/changelog/actions";

export const Route = createFileRoute("/changelog/")({
  head: () =>
    buildSeoHead({
      title: "Changelog",
      description: "What we've been shipping at Brimble.",
      path: "/changelog",
    }),
  staleTime: 60_000,
  loader: async (): Promise<ChangelogEntry[]> => {
    return (listChangelogServerFn as unknown as () => Promise<ChangelogEntry[]>)();
  },
  component: ChangelogPage,
});

type ChangelogDateGroup = {
  dateISO: string;
  date: string;
  entries: ChangelogEntry[];
};

const TYPE_BADGE_CLASS: Record<ChangelogType, string> = {
  Feature: "bg-[#e6f0ff] text-[#006fff] dark:bg-[#006fff]/15 dark:text-[#3b8eff]",
  Improvement: "bg-brimble-light-gray text-brimble-black/70 dark:bg-white/10 dark:text-brimble-black/70",
  Fix: "bg-[#fff4e6] text-[#b35900] dark:bg-[#b35900]/15 dark:text-[#ffa54d]",
};

const BADGE_BASE =
  "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[1.2px]";

function ChangelogPage() {
  const entries = Route.useLoaderData();
  const groups = groupEntriesByDate(entries);

  return (
    <div className="min-h-dvh bg-brimble-surface transition-colors duration-300">
      <Navbar />
      <main>
        <ChangelogHero />
        <ChangelogEntries groups={groups} />
        <Cta />
      </main>
    </div>
  );
}

function ChangelogHero() {
  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 pb-4 pt-16">
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <motion.h1
          className="font-heading text-[48px] font-medium italic leading-[54px] tracking-[-0.576px] text-brimble-black"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {siteConfig.changelog.page.heading}
        </motion.h1>
        <motion.p
          className="max-w-[519px] font-body text-base leading-[21px] tracking-[-0.32px] text-brimble-black/60"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {siteConfig.changelog.page.description}
        </motion.p>
      </div>
    </section>
  );
}

function ChangelogEntries({ groups }: { groups: ChangelogDateGroup[] }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  if (groups.length === 0) {
    return (
      <section className="bg-brimble-surface transition-colors duration-300 px-6 py-10">
        <div ref={ref} className="mx-auto flex max-w-[720px] flex-col gap-4">
          <motion.div
            className="rounded-xl border border-[rgba(152,157,164,0.3)] bg-brimble-surface p-8 text-center dark:border-white/10"
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="font-body text-base font-medium text-brimble-black">
              {siteConfig.changelog.page.empty}
            </p>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-brimble-surface transition-colors duration-300 px-6 py-10">
      <div ref={ref} className="mx-auto flex max-w-[720px] flex-col">
        {groups.map((group, groupIndex) => (
          <Fragment key={group.dateISO}>
            {groupIndex > 0 && <div className="h-px w-full bg-brimble-black/10 dark:bg-white/10" />}
            <div className="py-10">
              <time dateTime={group.dateISO} className="font-mono text-xs uppercase tracking-[1.2px] text-brimble-black/50">
                {group.date}
              </time>
              <div className="mt-5 flex flex-col">
                {group.entries.map((entry, entryIndex) => (
                  <Fragment key={entry.slug}>
                    {entryIndex > 0 && <div className="my-8 h-px w-full bg-brimble-black/10 dark:bg-white/10" />}
                    <motion.article
                      id={entry.slug}
                      className="flex scroll-mt-24 flex-col gap-3"
                      initial={{ opacity: 0, y: 20 }}
                      animate={isInView ? { opacity: 1, y: 0 } : {}}
                      transition={{ duration: 0.6, delay: Math.min(groupIndex + entryIndex, 4) * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`${BADGE_BASE} ${TYPE_BADGE_CLASS[entry.type]}`}>{entry.type}</span>
                      </div>
                      <h2 className="font-body text-xl font-medium leading-[28px] tracking-[-0.24px] text-brimble-black">
                        {entry.title}
                      </h2>
                      <p className="font-body text-base leading-[1.6] text-brimble-black/70">{entry.summary}</p>
                      {entry.content.trim().length > 0 && (
                        <div className="mt-3">
                          <MarkdownContent content={entry.content} />
                        </div>
                      )}
                    </motion.article>
                  </Fragment>
                ))}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}

function groupEntriesByDate(entries: ChangelogEntry[]): ChangelogDateGroup[] {
  const groups = new Map<string, ChangelogDateGroup>();

  for (const entry of entries) {
    const existing = groups.get(entry.dateISO);
    if (existing) {
      existing.entries.push(entry);
      continue;
    }

    groups.set(entry.dateISO, {
      dateISO: entry.dateISO,
      date: entry.date,
      entries: [entry],
    });
  }

  return Array.from(groups.values());
}
