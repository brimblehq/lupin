import { motion } from "motion/react";
import { Button } from "@brimble/ui";
import arrowRight from "@/assets/icons/arrow-right.svg";

export function ObjectStorageHero() {
  return (
    <section className="bg-brimble-surface px-6 pb-16 pt-20 transition-colors duration-300">
      <div className="mx-auto flex max-w-[760px] flex-col items-center gap-6 text-center">
        <motion.span
          className="font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/50"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          Brimble Object Storage
        </motion.span>

        <motion.h1
          className="text-balance font-heading text-[44px] font-medium leading-[48px] tracking-[-0.576px] text-brimble-black md:text-[58px] md:leading-[60px]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          S3-compatible storage, minus the egress bill.
        </motion.h1>

        <motion.p
          className="max-w-[560px] text-pretty font-body text-[17px] leading-[25px] tracking-[-0.32px] text-black/60 dark:text-white/60"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          Store and serve uploads, static assets, build artifacts, and backups with the S3 API you already use. Point your existing SDK or
          CLI at Brimble — no rewrites, no transfer charges, sitting right next to the rest of your stack.
        </motion.p>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-2 pt-1"
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
              Create a bucket
              <img src={arrowRight} alt="" className="size-3 dark:brightness-0" />
            </a>
          </Button>
          <Button
            asChild
            variant="pill-light"
            size="sm"
            className="transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98]"
          >
            <a href="https://paper.brimble.io/object-storage/overview" target="_blank" rel="noopener noreferrer">
              Read the docs
            </a>
          </Button>
        </motion.div>

        {/* Endpoint diff card — the whole migration, in one line */}
        <motion.div
          className="mt-8 w-full overflow-hidden rounded-[14px] bg-[#1a1c1e] text-left shadow-[var(--shadow-dark-big)]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
            <span className="font-mono text-[10px] tracking-[1.4px] text-white/35">s3-client.ts</span>
            <span className="font-mono text-[10px] uppercase tracking-[1.4px] text-white/35">Drop-in · change one line</span>
          </div>
          <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-[22px] tracking-[-0.02px]">
            <code>
              <span className="block whitespace-pre text-white/45">{"  const s3 = new S3Client({"}</span>
              <span className="block whitespace-pre bg-[#ff5f57]/10 text-[#ff8d86]">
                {"-   endpoint: "}
                <span className="text-[#ff8d86]/70">"https://s3.amazonaws.com"</span>,
              </span>
              <span className="block whitespace-pre bg-[#28c840]/10 text-[#7ee08a]">
                {"+   endpoint: "}
                <span className="text-[#a5e3a5]">"https://objects.brimble.io"</span>,
              </span>
              <span className="block whitespace-pre text-white/45">{"    region,"}</span>
              <span className="block whitespace-pre text-white/45">{"    credentials,"}</span>
              <span className="block whitespace-pre text-white/45">
                {"    forcePathStyle: "}
                <span className="text-[#ff9b01]">true</span>,
              </span>
              <span className="block whitespace-pre text-white/45">{"  });"}</span>
            </code>
          </pre>
        </motion.div>
      </div>
    </section>
  );
}
