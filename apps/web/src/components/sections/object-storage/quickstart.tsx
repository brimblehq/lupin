import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { Check, Copy } from "lucide-react";

type Tab = {
  id: string;
  label: string;
  install: string;
  filename: string;
  source: string;
  highlight: (line: string) => React.ReactNode;
};

function tokenize(line: string, patterns: Array<[RegExp, string]>): React.ReactNode {
  const matches: Array<{ start: number; end: number; cls: string }> = [];
  for (const [re, cls] of patterns) {
    const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = r.exec(line)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (matches.some((x) => start < x.end && end > x.start)) continue;
      matches.push({ start, end, cls });
    }
  }
  matches.sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) out.push(<span key={`p-${i}`}>{line.slice(cursor, m.start)}</span>);
    out.push(
      <span key={`m-${i}`} className={m.cls}>
        {line.slice(m.start, m.end)}
      </span>,
    );
    cursor = m.end;
  });
  if (cursor < line.length) out.push(<span key="tail">{line.slice(cursor)}</span>);
  return out;
}

const TS_PATTERNS: Array<[RegExp, string]> = [
  [/\/\/.*$/g, "text-white/30"],
  [/"[^"]*"|'[^']*'/g, "text-[#a5e3a5]"],
  [/\b(import|from|const|let|await|async|new|return|export|function)\b/g, "text-[#c694ff]"],
  [/\b(S3Client|PutObjectCommand|GetObjectCommand|getSignedUrl)\b/g, "text-[#ffd479]"],
  [/\b(send|put|get)\b/g, "text-[#7fc8ff]"],
  [/\btrue\b|\bfalse\b/g, "text-[#ff9b01]"],
];

const PY_PATTERNS: Array<[RegExp, string]> = [
  [/#.*$/g, "text-white/30"],
  [/"[^"]*"|'[^']*'/g, "text-[#a5e3a5]"],
  [/\b(import|from|with|as|await|async|def|return)\b/g, "text-[#c694ff]"],
  [/\b(boto3|Config)\b/g, "text-[#ffd479]"],
  [/\b(client|put_object|get_object|read)\b/g, "text-[#7fc8ff]"],
];

const SH_PATTERNS: Array<[RegExp, string]> = [
  [/#.*$/g, "text-white/30"],
  [/"[^"]*"|'[^']*'/g, "text-[#a5e3a5]"],
  [/\b(aws|export)\b/g, "text-[#c694ff]"],
  [/--[A-Za-z-]+/g, "text-[#ffd479]"],
  [/\bs3:\/\/[^\s'"]+/g, "text-[#a5e3a5]"],
  [/https?:\/\/[^\s'"]+/g, "text-[#7fc8ff]"],
];

const tabs: Tab[] = [
  {
    id: "ts",
    label: "TypeScript",
    install: "npm install @aws-sdk/client-s3",
    filename: "upload.ts",
    source: `import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

// Point the standard AWS SDK at your Brimble bucket
const s3 = new S3Client({
  endpoint: process.env.BRIMBLE_S3_ENDPOINT,
  region: process.env.BRIMBLE_S3_REGION,
  credentials: {
    accessKeyId: process.env.BRIMBLE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.BRIMBLE_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

// Put an object
await s3.send(new PutObjectCommand({
  Bucket: "app-uploads",
  Key: "reports/2026/q1.pdf",
  Body: pdfBytes,
  ContentType: "application/pdf",
}));

// Get it back
const obj = await s3.send(new GetObjectCommand({
  Bucket: "app-uploads",
  Key: "reports/2026/q1.pdf",
}));`,
    highlight: (line) => tokenize(line, TS_PATTERNS),
  },
  {
    id: "py",
    label: "Python",
    install: "pip install boto3",
    filename: "upload.py",
    source: `import os
import boto3

# Point boto3 at your Brimble bucket
client = boto3.client(
    "s3",
    endpoint_url=os.environ["BRIMBLE_S3_ENDPOINT"],
    region_name=os.environ["BRIMBLE_S3_REGION"],
    aws_access_key_id=os.environ["BRIMBLE_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["BRIMBLE_SECRET_ACCESS_KEY"],
    config=boto3.session.Config(s3={"addressing_style": "path"}),
)

# Put an object
with open("q1.pdf", "rb") as f:
    client.put_object(Bucket="app-uploads", Key="reports/2026/q1.pdf", Body=f)

# Get it back
obj = client.get_object(Bucket="app-uploads", Key="reports/2026/q1.pdf")
data = obj["Body"].read()`,
    highlight: (line) => tokenize(line, PY_PATTERNS),
  },
  {
    id: "sh",
    label: "AWS CLI",
    install: "aws configure",
    filename: "upload.sh",
    source: `# Copy a file up
aws s3 cp ./q1.pdf s3://app-uploads/reports/2026/q1.pdf \\
  --endpoint-url https://objects.brimble.io

# List a prefix
aws s3 ls s3://app-uploads/reports/2026/ \\
  --endpoint-url https://objects.brimble.io

# Copy it back down
aws s3 cp s3://app-uploads/reports/2026/q1.pdf ./q1.pdf \\
  --endpoint-url https://objects.brimble.io`,
    highlight: (line) => tokenize(line, SH_PATTERNS),
  },
];

export function ObjectStorageQuickstart() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [active, setActive] = useState(tabs[0].id);
  const [copied, setCopied] = useState(false);

  const tab = tabs.find((t) => t.id === active) ?? tabs[0];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tab.source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  return (
    <section className="border-t border-[rgba(152,157,164,0.2)] bg-brimble-air-gray px-6 py-[104px] transition-colors duration-300 dark:border-white/5">
      <div ref={ref} className="mx-auto flex max-w-[820px] flex-col items-center gap-10">
        <motion.div
          className="flex max-w-[600px] flex-col items-center gap-3 text-center"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="font-mono text-xs uppercase tracking-[1.6px] text-brimble-black/50">Quickstart</span>
          <h2 className="text-balance font-heading text-[40px] font-medium leading-[46px] tracking-[-0.576px] text-brimble-black md:text-[44px] md:leading-[50px]">
            Swap the endpoint. Keep your code.
          </h2>
          <p className="text-pretty font-body text-base leading-[23px] tracking-[-0.32px] text-brimble-black/60">
            Set the endpoint, region, and access key — then list, put, get, delete, copy, and multipart-upload exactly as you would on S3.
            The AWS SDKs, the AWS CLI, boto3, rclone, and mc all work as-is.
          </p>
        </motion.div>

        <motion.div
          className="w-full overflow-hidden rounded-[14px] bg-[#1a1c1e] shadow-[var(--shadow-dark-big)]"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Tab bar */}
          <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2">
            <div className="flex gap-1" role="tablist" aria-label="Quickstart languages">
              {tabs.map((t) => {
                const isActive = t.id === active;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(t.id)}
                    className={`relative rounded-[6px] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[1.2px] transition-colors duration-150 ${
                      isActive ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 pr-1 font-mono text-[10px] uppercase tracking-[1.4px] text-white/35">
              <span className="hidden normal-case sm:inline">{tab.filename}</span>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-white/55 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white"
                aria-label="Copy code"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Code body */}
          <div className="overflow-x-auto px-4 pb-6 pt-4">
            <pre className="font-mono text-[12.5px] leading-[21px] tracking-[-0.02px] text-white/80">
              <code>
                {tab.source.split("\n").map((line, i) => (
                  <span key={i} className="block whitespace-pre">
                    <span className="mr-3 inline-block w-5 select-none text-right text-white/25">{i + 1}</span>
                    {line.length ? tab.highlight(line) : <span>&nbsp;</span>}
                  </span>
                ))}
              </code>
            </pre>
          </div>

          {/* Footer — install line */}
          <div className="flex items-center gap-3 border-t border-white/[0.06] bg-[#161819] px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[1.4px] text-white/35">Install</span>
            <code className="font-mono text-[12px] text-white/70">{tab.install}</code>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
