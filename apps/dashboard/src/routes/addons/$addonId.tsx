import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowLeft, Copy, Check, ExternalLink } from "lucide-react";
import { DashButton } from "../../components/shared/dash-button";
import { AddonCard } from "../../components/shared/addon-card";
import type { Addon } from "../../components/shared/addon-card";

export const Route = createFileRoute("/addons/$addonId")({
  component: AddonDetailPage,
});

const ease = [0.16, 1, 0.3, 1] as const;

/* ─── Mock data ─── */

interface AddonDetail extends Addon {
  longDescription: string;
  developer: string;
  category: string;
  installs: string;
  website: string;
  documentationUrl: string;
  envVars: { key: string; value: string }[];
}

const addonDetails: Record<string, AddonDetail> = {
  launchdarkly: {
    id: "launchdarkly",
    name: "LaunchDarkly",
    description: "Feature flags & experimentation platform",
    gradient: "from-[#8653ea] to-[#edbff6]",
    logo: "🚀",
    logoBg: "#3d2c00",
    installed: true,
    longDescription:
      "LaunchDarkly is a feature management platform that empowers all teams to safely deliver and control software through feature flags. With the LaunchDarkly addon, you can connect your Brimble project to manage feature rollouts, run A/B experiments, and control infrastructure flags — all without redeploying. Toggle features on and off in real-time, target specific user segments, and measure the impact of every change.",
    developer: "LaunchDarkly Inc.",
    category: "Feature Management",
    installs: "2.4K+",
    website: "www.launchdarkly.com",
    documentationUrl: "#",
    envVars: [
      { key: "LAUNCHDARKLY_SDK_KEY", value: "sdk-***-****-****" },
      { key: "LAUNCHDARKLY_CLIENT_ID", value: "cli-***-****-****" },
      { key: "LAUNCHDARKLY_PROJECT", value: "default" },
      { key: "LAUNCHDARKLY_ENVIRONMENT", value: "production" },
    ],
  },
  supabase: {
    id: "supabase",
    name: "Supabase",
    description: "Open source Firebase alternative",
    gradient: "from-[#e9bd4b] to-[#dce94b]",
    logo: "⚡",
    logoBg: "#1a5c2e",
    installed: true,
    longDescription:
      "Supabase is an open source Firebase alternative providing a Postgres database, authentication, instant APIs, edge functions, realtime subscriptions, and storage. Connect your Brimble project to Supabase to get a production-ready backend in minutes. Manage your database schema, set up row-level security, and build real-time features without managing infrastructure.",
    developer: "Supabase Inc.",
    category: "Backend as a Service",
    installs: "8.1K+",
    website: "www.supabase.com",
    documentationUrl: "#",
    envVars: [
      { key: "SUPABASE_URL", value: "https://*****.supabase.co" },
      { key: "SUPABASE_ANON_KEY", value: "eyJ***" },
      { key: "SUPABASE_SERVICE_ROLE_KEY", value: "eyJ***" },
      { key: "SUPABASE_DB_URL", value: "postgresql://postgres:***@***:5432/postgres" },
    ],
  },
  stripe: {
    id: "stripe",
    name: "Stripe",
    description: "Online payment processing for internet businesses",
    gradient: "from-[#ea51bd] to-[#f6b2c9]",
    logo: "💳",
    logoBg: "#32297a",
    installed: true,
    longDescription:
      "Stripe is the leading payment infrastructure platform for the internet. With the Stripe addon, connect your Brimble project to accept payments, manage subscriptions, and handle billing. Stripe's APIs power commerce for millions of businesses, from startups to Fortune 500 companies. Set up webhooks, manage products and pricing, and process payments seamlessly.",
    developer: "Stripe Inc.",
    category: "Payments",
    installs: "12K+",
    website: "www.stripe.com",
    documentationUrl: "#",
    envVars: [
      { key: "STRIPE_PUBLIC_KEY", value: "pk_live_***" },
      { key: "STRIPE_SECRET_KEY", value: "sk_live_***" },
      { key: "STRIPE_WEBHOOK_SECRET", value: "whsec_***" },
    ],
  },
  sentry: {
    id: "sentry",
    name: "Sentry",
    description: "Application monitoring & error tracking",
    gradient: "from-[#53d8ea] to-[#266bf2]",
    logo: "🛡️",
    logoBg: "#2b1537",
    longDescription:
      "Sentry provides self-hosted and cloud-based error monitoring that helps all software teams discover, triage, and prioritize errors in real-time. Connect Sentry to your Brimble project to automatically capture exceptions, track performance issues, and get alerted when things break — before your users notice.",
    developer: "Sentry Inc.",
    category: "Monitoring",
    installs: "5.6K+",
    website: "www.sentry.io",
    documentationUrl: "#",
    envVars: [
      { key: "SENTRY_DSN", value: "https://***@***.ingest.sentry.io/***" },
      { key: "SENTRY_AUTH_TOKEN", value: "sntrys_***" },
      { key: "SENTRY_ORG", value: "my-org" },
      { key: "SENTRY_PROJECT", value: "my-project" },
    ],
  },
  datadog: {
    id: "datadog",
    name: "Datadog",
    description: "Cloud-scale monitoring & security",
    gradient: "from-[#e94b4b] to-[#e94bbd]",
    logo: "🐶",
    logoBg: "#3a1a5c",
    longDescription:
      "Datadog is the monitoring and security platform for cloud applications. Bring together end-to-end traces, metrics, and logs to make your applications, infrastructure, and third-party services entirely observable. Connect Datadog to your Brimble project for real-time dashboards, intelligent alerting, and deep visibility into your deployment performance.",
    developer: "Datadog Inc.",
    category: "Monitoring",
    installs: "3.2K+",
    website: "www.datadoghq.com",
    documentationUrl: "#",
    envVars: [
      { key: "DD_API_KEY", value: "***" },
      { key: "DD_APP_KEY", value: "***" },
      { key: "DD_SITE", value: "datadoghq.com" },
    ],
  },
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare",
    description: "CDN, DDoS protection & DNS services",
    gradient: "from-[#6ab7ff] to-[#594cf3]",
    logo: "☁️",
    logoBg: "#1a3a5c",
    longDescription:
      "Cloudflare provides a global network designed to make everything you connect to the Internet secure, private, fast, and reliable. Connect Cloudflare to your Brimble project to manage DNS records, configure CDN caching, and protect your deployments with DDoS mitigation and Web Application Firewall rules.",
    developer: "Cloudflare Inc.",
    category: "Infrastructure",
    installs: "6.8K+",
    website: "www.cloudflare.com",
    documentationUrl: "#",
    envVars: [
      { key: "CLOUDFLARE_API_TOKEN", value: "***" },
      { key: "CLOUDFLARE_ZONE_ID", value: "***" },
      { key: "CLOUDFLARE_ACCOUNT_ID", value: "***" },
    ],
  },
  redis: {
    id: "redis",
    name: "Upstash Redis",
    description: "Serverless Redis for low latency data",
    gradient: "from-[#d80eff] via-[#d80eff]/[0.36] to-[#3d3055]",
    logo: "🔴",
    logoBg: "#5c1a1a",
    longDescription:
      "Upstash provides serverless Redis with per-request pricing and global replication. Connect Upstash Redis to your Brimble project for caching, session storage, rate limiting, and real-time leaderboards. With a REST API and native Redis protocol support, it works anywhere — from edge functions to serverless backends.",
    developer: "Upstash Inc.",
    category: "Database",
    installs: "1.9K+",
    website: "www.upstash.com",
    documentationUrl: "#",
    envVars: [
      { key: "UPSTASH_REDIS_REST_URL", value: "https://***-***.upstash.io" },
      { key: "UPSTASH_REDIS_REST_TOKEN", value: "***" },
    ],
  },
  planetscale: {
    id: "planetscale",
    name: "PlanetScale",
    description: "Serverless MySQL platform",
    gradient: "from-[#4be9df] to-[#dce94b]",
    logo: "🪐",
    logoBg: "#1a3d5c",
    longDescription:
      "PlanetScale is the MySQL-compatible serverless database platform. Built on Vitess, it offers branching, non-blocking schema changes, and unlimited scale. Connect PlanetScale to your Brimble project to get a production-grade relational database with zero-downtime migrations and automatic connection pooling.",
    developer: "PlanetScale Inc.",
    category: "Database",
    installs: "4.1K+",
    website: "www.planetscale.com",
    documentationUrl: "#",
    envVars: [
      { key: "DATABASE_URL", value: "mysql://***:***@***.connect.psdb.cloud/***?sslaccept=strict" },
      { key: "PLANETSCALE_ORG", value: "my-org" },
      { key: "PLANETSCALE_DB", value: "my-database" },
    ],
  },
  resend: {
    id: "resend",
    name: "Resend",
    description: "Email API for developers",
    gradient: "from-[#ec6492] to-[#e9be4b]",
    logo: "✉️",
    logoBg: "#2b1537",
    longDescription:
      "Resend is the email API built for developers. Send transactional and marketing emails at scale with a modern, developer-first API. Connect Resend to your Brimble project to send beautiful emails using React components, track deliverability, and manage audiences — all from your codebase.",
    developer: "Resend Inc.",
    category: "Communications",
    installs: "1.5K+",
    website: "www.resend.com",
    documentationUrl: "#",
    envVars: [
      { key: "RESEND_API_KEY", value: "re_***" },
      { key: "RESEND_FROM_EMAIL", value: "noreply@yourdomain.com" },
    ],
  },
};

const relatedAddons: Addon[] = [
  {
    id: "datadog",
    name: "Datadog",
    description: "Cloud-scale monitoring & security",
    gradient: "from-[#e94b4b] to-[#e94bbd]",
    logo: "🐶",
    logoBg: "#3a1a5c",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    description: "CDN, DDoS protection & DNS services",
    gradient: "from-[#6ab7ff] to-[#594cf3]",
    logo: "☁️",
    logoBg: "#1a3a5c",
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Application monitoring & error tracking",
    gradient: "from-[#53d8ea] to-[#266bf2]",
    logo: "🛡️",
    logoBg: "#2b1537",
  },
];

/* ─── Copyable env var row ─── */

function EnvVarRow({ varKey, value }: { varKey: string; value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(`${varKey}=${value}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 font-mono text-[11px] leading-5 text-[#aadafa]">
        {varKey}
      </span>
      <button
        onClick={handleCopy}
        className="shrink-0 text-[#4a505c] transition-colors hover:text-[#9da3ae]"
      >
        {copied ? (
          <Check className="size-3.5 text-[#28c840]" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  );
}

/* ─── Page ─── */

function AddonDetailPage() {
  const { addonId } = Route.useParams();
  const addon = addonDetails[addonId];

  if (!addon) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-dash-text-faded">Addon not found.</p>
          <Link
            to="/addons"
            className="mt-2 inline-flex items-center gap-1 text-sm text-[#4879f8] hover:underline"
          >
            <ArrowLeft className="size-3" />
            Back to addons
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-10">
      {/* Back link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Link
          to="/addons"
          className="inline-flex items-center gap-1 text-sm text-dash-text-faded underline underline-offset-2 transition-colors hover:text-dash-text-strong"
        >
          Back
        </Link>
      </motion.div>

      {/* Hero: banner + description */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease }}
        className="mt-5 flex flex-col gap-6 lg:flex-row lg:gap-8"
      >
        {/* Banner card */}
        <div
          className={`relative h-[210px] w-full shrink-0 overflow-clip rounded-[8px] bg-gradient-to-b ${addon.gradient} lg:w-[437px]`}
        >
          {/* Browser mockup */}
          <div
            className="absolute top-[26px] bottom-0 w-[388px] overflow-clip rounded-t-[4px] border-[0.5px] border-[#e6e5e5] border-b-0 bg-[#fbfbfb]"
            style={{ left: "calc(50% + 80.5px)", transform: "translateX(-50%)" }}
          >
            <div className="flex items-center gap-[3px] px-2.5 py-[6px]">
              <span className="size-[5px] rounded-full bg-[#d9d9d9]" />
              <span className="size-[5px] rounded-full bg-[#d9d9d9]" />
              <span className="size-[5px] rounded-full bg-[#d9d9d9]" />
            </div>
            <div className="mx-[6px] h-px bg-[#e6e5e5]" />
          </div>

          {/* Logo */}
          <div
            className="absolute left-[17px] top-[18px] flex size-[60px] items-center justify-center rounded-full"
            style={{ backgroundColor: addon.logoBg }}
          >
            <span className="text-2xl">{addon.logo}</span>
          </div>
        </div>

        {/* Text + actions */}
        <div className="flex flex-col justify-between">
          <div>
            <h1 className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">
              {addon.name}
            </h1>
            <p className="mt-2 text-sm font-light leading-[1.3] text-dash-text-faded">
              {addon.description}. Connect it to your Brimble project and streamline your workflow.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <DashButton variant="primary" size="default">
              Install addon
            </DashButton>
            <DashButton variant="outline" size="default">
              View documentation
            </DashButton>
          </div>
        </div>
      </motion.div>

      {/* Divider */}
      <hr className="my-8 border-dash-border-soft" />

      {/* Placeholder gallery */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1, ease }}
        className="scrollbar-hidden flex gap-3.5 overflow-x-auto"
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[203px] w-[370px] shrink-0 rounded-[8px] bg-dash-bg-elevated dark:bg-[#29292a]"
          />
        ))}
      </motion.div>

      {/* Divider */}
      <hr className="my-8 border-dash-border-soft" />

      {/* More details: two-column */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15, ease }}
        className="flex flex-col gap-8 lg:flex-row"
      >
        {/* Left: description + env vars */}
        <div className="flex-1">
          <h2 className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">
            More details
          </h2>
          <p className="mt-3 text-sm font-light leading-[1.45] text-dash-text-faded">
            {addon.longDescription}
          </p>

          {/* Env vars code block */}
          {addon.envVars.length > 0 && (
            <div className="mt-6 overflow-clip rounded-[4px]">
              {/* Header */}
              <div className="border-b border-[#394150] bg-[#212936] px-4 py-2">
                <span className="text-[11px] font-light text-[#9da3ae]">
                  Public Environment Variables
                </span>
              </div>
              {/* Body */}
              <div className="flex flex-col gap-2 bg-[#121826] px-4 py-3">
                {addon.envVars.map((ev, i) => (
                  <div key={ev.key} className="flex items-center gap-3">
                    <span className="w-4 shrink-0 text-right font-mono text-[10px] text-[#4a505c]">
                      {i + 1}
                    </span>
                    <EnvVarRow varKey={ev.key} value={ev.value} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: metadata table */}
        <div className="w-full shrink-0 lg:w-[320px]">
          {[
            { label: "Installs", value: addon.installs },
            { label: "Developer", value: addon.developer },
            { label: "Category", value: addon.category },
            {
              label: "Website",
              value: addon.website,
              href: `https://${addon.website}`,
            },
            {
              label: "Documentation",
              value: "Read",
              href: addon.documentationUrl,
            },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              className={`flex items-center justify-between px-3.5 py-3 ${
                i < arr.length - 1 ? "border-b-[0.5px] border-dash-border-soft" : ""
              }`}
            >
              <span className="text-sm font-light text-dash-text-body">
                {row.label}
              </span>
              {row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-light text-dash-text-faded transition-colors hover:text-dash-text-strong"
                >
                  {row.value}
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-sm font-light text-dash-text-faded">
                  {row.value}
                </span>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Divider */}
      <hr className="my-8 border-dash-border-soft" />

      {/* More like this */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2, ease }}
      >
        <h2 className="mb-4 text-base font-medium tracking-[-0.03px] text-dash-text-strong">
          More like this
        </h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {relatedAddons
            .filter((a) => a.id !== addonId)
            .slice(0, 3)
            .map((a) => (
              <AddonCard key={a.id} addon={a} />
            ))}
        </div>
      </motion.div>
    </div>
  );
}
