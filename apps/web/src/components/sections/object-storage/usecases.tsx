import { useRef } from "react";
import { motion, useInView } from "motion/react";

const cases = [
  {
    title: "User uploads",
    body: "Take avatars, attachments, and media straight from the browser with a presigned URL, then serve them back the same way.",
    code: "s3://app-uploads/users/42/avatar.png",
  },
  {
    title: "Static & media assets",
    body: "Keep large images, video, and generated reports out of your repo and off your app servers.",
    code: "s3://assets/media/2026/cover.jpg",
  },
  {
    title: "Build artifacts",
    body: "Stash deploy output and cache layers next to the pipeline that produces them.",
    code: "s3://artifacts/builds/9f3a2c.tar.gz",
  },
  {
    title: "Backups & exports",
    body: "Write database dumps and exports on a schedule, and pull them back when you need them.",
    code: "s3://backups/db/2026-06-01.sql.gz",
  },
  {
    title: "Data pipelines",
    body: "Land raw inputs, read them from a job, and write results back to the same bucket.",
    code: "s3://data-lake/events/2026/06/01/",
  },
] as const;

export function ObjectStorageUseCases() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="bg-brimble-surface px-6 py-[104px] transition-colors duration-300">
      <div ref={ref} className="mx-auto grid max-w-[1080px] grid-cols-1 gap-x-16 gap-y-12 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <motion.div
          className="flex flex-col gap-3 md:sticky md:top-28 md:self-start"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/50">What people store</span>
          <h2 className="text-balance font-heading text-[40px] font-medium leading-[46px] tracking-[-0.576px] text-brimble-black md:text-[44px] md:leading-[50px]">
            One bucket type, every kind of object.
          </h2>
          <p className="max-w-[360px] text-pretty font-body text-base leading-[23px] tracking-[-0.32px] text-brimble-black/60">
            A path is just a key. Address anything from a single avatar to a partitioned data lake the same way.
          </p>
        </motion.div>

        <div className="flex flex-col">
          {cases.map((c, i) => (
            <motion.div
              key={c.title}
              className="flex flex-col gap-2 border-t border-[rgba(152,157,164,0.25)] py-6 first:border-t-0 first:pt-0 dark:border-white/10"
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <h3 className="font-body text-[18px] font-medium leading-[24px] tracking-[-0.32px] text-brimble-black">{c.title}</h3>
                <code className="shrink-0 font-mono text-[11.5px] text-brimble-black/45">{c.code}</code>
              </div>
              <p className="max-w-[520px] text-pretty font-body text-[14.5px] leading-[21px] tracking-[-0.2px] text-brimble-black/60">
                {c.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
