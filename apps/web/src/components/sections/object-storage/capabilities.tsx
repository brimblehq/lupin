import { useRef } from "react";
import { motion, useInView } from "motion/react";

/* ── Visuals ─────────────────────────────────────────────── */

function OpsVisual() {
  const ops = ["list", "head", "get", "put", "delete", "copy", "multipart"];
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[rgba(152,157,164,0.25)] bg-brimble-air-gray p-6 dark:border-white/10 dark:bg-[#1a1c1e]">
      <div className="flex flex-wrap gap-1.5">
        {ops.map((op) => (
          <span
            key={op}
            className="rounded-md bg-brimble-surface px-2.5 py-1 font-mono text-[11px] text-brimble-black/65 shadow-[var(--shadow-button)] dark:bg-[#222528]"
          >
            {op}
          </span>
        ))}
      </div>
      <pre className="overflow-x-auto rounded-md bg-[#1a1c1e] px-3 py-2.5 font-mono text-[11.5px] leading-[18px] text-white/80">
        <code>
          <span className="block whitespace-pre text-white/45"># works with the tools you have</span>
          <span className="block whitespace-pre">
            <span className="text-[#c694ff]">aws</span> s3 ls <span className="text-[#a5e3a5]">s3://app-uploads</span>
          </span>
          <span className="block whitespace-pre">
            <span className="text-[#c694ff]">rclone</span> copy ./dist <span className="text-[#a5e3a5]">brimble:assets</span>
          </span>
        </code>
      </pre>
    </div>
  );
}

function PresignVisual() {
  return (
    <div className="rounded-2xl border border-[rgba(152,157,164,0.25)] bg-brimble-air-gray p-6 dark:border-white/10 dark:bg-[#1a1c1e]">
      <svg viewBox="0 0 320 150" className="h-auto w-full" aria-hidden="true">
        {/* server */}
        <rect x="8" y="56" width="86" height="40" rx="6" className="fill-brimble-surface stroke-brimble-black/20 dark:fill-[#222528]" />
        <text x="51" y="80" textAnchor="middle" className="fill-brimble-black/65 font-mono text-[10px]">
          your app
        </text>
        {/* arrow to bucket */}
        <path d="M 94 76 L 130 76" className="stroke-brimble-black/30" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x="112" y="68" textAnchor="middle" className="fill-brimble-black/40 font-mono text-[8px] uppercase tracking-[1px]">
          sign
        </text>
        {/* bucket */}
        <rect x="130" y="56" width="86" height="40" rx="6" className="fill-brimble-surface stroke-brimble-black/20 dark:fill-[#222528]" />
        <text x="173" y="80" textAnchor="middle" className="fill-brimble-black/65 font-mono text-[10px]">
          bucket
        </text>
        {/* signed url out to browser */}
        <path d="M 173 96 L 173 120 L 280 120 L 280 100" className="fill-none stroke-brimble-accent-blue/60" strokeWidth="1.5" />
        <path d="M 274 106 L 280 98 L 286 106" className="fill-none stroke-brimble-accent-blue/60" strokeWidth="1.5" />
        <rect x="244" y="56" width="68" height="40" rx="6" className="fill-brimble-accent-blue/10 stroke-brimble-accent-blue/40" />
        <text x="278" y="73" textAnchor="middle" className="fill-brimble-accent-blue font-mono text-[9px]">
          browser
        </text>
        <text x="278" y="86" textAnchor="middle" className="fill-brimble-accent-blue/80 font-mono text-[8px] uppercase tracking-[1px]">
          15 min
        </text>
      </svg>
    </div>
  );
}

function StackVisual() {
  const layers = ["Apps", "Databases", "Object Storage"];
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[rgba(152,157,164,0.25)] bg-brimble-air-gray p-6 dark:border-white/10 dark:bg-[#1a1c1e]">
      {layers.map((l, i) => (
        <div
          key={l}
          className={`flex items-center justify-between rounded-lg px-4 py-3 ${
            i === 2 ? "bg-brimble-accent-blue/10 ring-1 ring-brimble-accent-blue/30" : "bg-brimble-surface dark:bg-[#222528]"
          }`}
        >
          <span className={`font-body text-[14px] font-medium ${i === 2 ? "text-brimble-accent-blue" : "text-brimble-black/70"}`}>{l}</span>
          <span className="font-mono text-[10px] uppercase tracking-[1.2px] text-brimble-black/35">one account</span>
        </div>
      ))}
    </div>
  );
}

/* ── Rows ────────────────────────────────────────────────── */

type Row = {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
};

const rows: Row[] = [
  {
    eyebrow: "Compatibility",
    title: "Drop-in S3, across every tool you already run.",
    body: "The API surface is S3-compatible, so anything that speaks S3 works unchanged — the AWS SDKs, the AWS CLI, boto3, rclone, mc, s3cmd. Set the endpoint, region, and access key, and the operations you already call just work.",
    points: ["No SDK rewrites — same commands, new endpoint", "list, head, get, put, delete, copy, multipart"],
    visual: <OpsVisual />,
  },
  {
    eyebrow: "Access",
    title: "Private by default, shared by presigned URL.",
    body: "Objects are private — reads and writes need a valid storage credential, so there's no anonymous public-read URL to leak. When you do need to hand a file out, mint a temporary signed URL for a single upload or download without your credentials ever leaving the server.",
    points: ["Access keys scoped to Editor or ReadOnly, rotatable", "Per-bucket CORS rules for direct browser uploads"],
    visual: <PresignVisual />,
  },
  {
    eyebrow: "Co-location",
    title: "Storage that lives next to the rest of your stack.",
    body: "Buckets are account-level and shared across your services, independent of any single project. Your apps, databases, and storage sit on one platform — fewer providers to wire together, one bill, one dashboard, and data that doesn't round-trip the public internet to reach your compute.",
    points: ["Pick each bucket's region at creation", "Objects stay put — no surprise cross-region movement"],
    visual: <StackVisual />,
  },
];

function CapabilityRow({ row, index }: { row: Row; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const reverse = index % 2 === 1;

  return (
    <div ref={ref} className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
      <motion.div
        className={`flex flex-col gap-4 ${reverse ? "md:order-2" : ""}`}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/50">{row.eyebrow}</span>
        <h3 className="text-balance font-heading text-[28px] font-medium leading-[32px] tracking-[-0.46px] text-brimble-black md:text-[32px] md:leading-[36px]">
          {row.title}
        </h3>
        <p className="text-pretty font-body text-base leading-[23px] tracking-[-0.32px] text-brimble-black/60">{row.body}</p>
        <ul className="mt-1 flex flex-col gap-2">
          {row.points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 font-body text-[14.5px] leading-[20px] text-brimble-black/70">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brimble-accent-blue" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div
        className={reverse ? "md:order-1" : ""}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
      >
        {row.visual}
      </motion.div>
    </div>
  );
}

export function ObjectStorageCapabilities() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="bg-brimble-surface px-6 py-[104px] transition-colors duration-300">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-20">
        <motion.div
          ref={ref}
          className="flex max-w-[640px] flex-col gap-3"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/50">What you get</span>
          <h2 className="text-balance font-heading text-[40px] font-medium leading-[46px] tracking-[-0.576px] text-brimble-black md:text-[44px] md:leading-[50px]">
            The S3 surface you know, without the parts you don't.
          </h2>
        </motion.div>

        <div className="flex flex-col gap-20">
          {rows.map((row, i) => (
            <CapabilityRow key={row.eyebrow} row={row} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
