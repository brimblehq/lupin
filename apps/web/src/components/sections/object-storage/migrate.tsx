import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Button } from "@brimble/ui";

const steps = [
  {
    title: "Create a bucket",
    body: "Pick a name and a region in the dashboard — choose the region closest to your compute.",
  },
  {
    title: "Point Brimble at your source",
    body: "Add the source bucket's name, region, endpoint, and a read-only credential under Migrations → New migration.",
  },
  {
    title: "Let it copy server-side",
    body: "Object data, content type, and metadata copy directly — you don't proxy bytes through your laptop. Watch progress as it runs.",
  },
  {
    title: "Issue keys and cut over",
    body: "When the copy finishes, issue storage credentials for your apps and point them at the new bucket.",
  },
] as const;

export function ObjectStorageMigrate() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="border-t border-[rgba(152,157,164,0.2)] bg-brimble-air-gray px-6 py-[104px] transition-colors duration-300 dark:border-white/5">
      <div
        ref={ref}
        className="mx-auto grid max-w-[1080px] grid-cols-1 gap-x-16 gap-y-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-start"
      >
        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/50">Moving in</span>
          <h2 className="text-balance font-heading text-[40px] font-medium leading-[46px] tracking-[-0.576px] text-brimble-black md:text-[44px] md:leading-[50px]">
            Migrate from any S3-compatible provider.
          </h2>
          <p className="max-w-[400px] text-pretty font-body text-base leading-[23px] tracking-[-0.32px] text-brimble-black/60">
            Already on AWS S3, Cloudflare R2, or Backblaze B2? Because the API matches, moving over is a configuration change — give Brimble
            read-only access and it copies everything across for you.
          </p>
          <div className="pt-1">
            <Button
              asChild
              variant="pill-light"
              size="sm"
              className="transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98]"
            >
              <a href="https://paper.brimble.io/object-storage/migrate" target="_blank" rel="noopener noreferrer">
                Read the migration guide
              </a>
            </Button>
          </div>
        </motion.div>

        <ol className="flex flex-col">
          {steps.map((s, i) => (
            <motion.li
              key={s.title}
              className="flex gap-5 border-t border-[rgba(152,157,164,0.25)] py-5 first:border-t-0 first:pt-0 dark:border-white/10"
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="font-mono text-[13px] leading-[24px] text-brimble-accent-blue">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex flex-col gap-1">
                <h3 className="font-body text-[16px] font-medium leading-[24px] tracking-[-0.32px] text-brimble-black">{s.title}</h3>
                <p className="text-pretty font-body text-[14px] leading-[20px] tracking-[-0.2px] text-brimble-black/60">{s.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
