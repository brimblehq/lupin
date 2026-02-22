import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import { DashButton } from "../../components/shared/dash-button";
import { AddonCard } from "../../components/shared/addon-card";
import type { Addon } from "../../components/shared/addon-card";

export const Route = createFileRoute("/addons/")({
  component: AddonsPage,
});

const ease = [0.16, 1, 0.3, 1] as const;

const installedAddons: Addon[] = [
  {
    id: "launchdarkly",
    name: "LaunchDarkly",
    description: "Feature flags & experimentation platform",
    gradient: "from-[#8653ea] to-[#edbff6]",
    logo: "🚀",
    logoBg: "#3d2c00",
    installed: true,
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Open source Firebase alternative",
    gradient: "from-[#e9bd4b] to-[#dce94b]",
    logo: "⚡",
    logoBg: "#1a5c2e",
    installed: true,
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Online payment processing for internet businesses",
    gradient: "from-[#ea51bd] to-[#f6b2c9]",
    logo: "💳",
    logoBg: "#32297a",
    installed: true,
  },
];

const marketplaceAddons: Addon[] = [
  {
    id: "sentry",
    name: "Sentry",
    description: "Application monitoring & error tracking",
    gradient: "from-[#53d8ea] to-[#266bf2]",
    logo: "🛡️",
    logoBg: "#2b1537",
  },
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
    id: "redis",
    name: "Upstash Redis",
    description: "Serverless Redis for low latency data",
    gradient: "from-[#d80eff] via-[#d80eff]/[0.36] to-[#3d3055]",
    logo: "🔴",
    logoBg: "#5c1a1a",
  },
  {
    id: "planetscale",
    name: "PlanetScale",
    description: "Serverless MySQL platform",
    gradient: "from-[#4be9df] to-[#dce94b]",
    logo: "🪐",
    logoBg: "#1a3d5c",
  },
  {
    id: "resend",
    name: "Resend",
    description: "Email API for developers",
    gradient: "from-[#ec6492] to-[#e9be4b]",
    logo: "✉️",
    logoBg: "#2b1537",
  },
];

const inputClass =
  "w-full rounded-[6px] bg-[#f9fafb] px-3 py-2 text-sm leading-6 text-dash-text-strong shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] outline-none placeholder:text-[#9ca3af] focus:shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08),0px_0px_0px_3px_rgba(72,121,248,0.15)] dark:bg-[#1a1c1e] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08),0px_0px_0px_3px_rgba(72,121,248,0.2)]";

function AddonsPage() {
  const [search, setSearch] = useState("");

  const allAddons = [...installedAddons, ...marketplaceAddons];
  const filtered = search
    ? allAddons.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.description.toLowerCase().includes(search.toLowerCase()),
      )
    : null;

  return (
    <div className="px-4 py-8 md:px-10">
      {/* Hero banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease }}
        className="relative overflow-clip rounded-[4px] border-[0.5px] border-dash-border-soft"
      >
        <div className="relative z-10 px-8 py-8">
          <h2 className="text-base font-medium tracking-[-0.03px] text-dash-text-strong">
            Installed Addons
          </h2>
          <p className="mt-1 max-w-[560px] text-sm font-light leading-[1.3] text-dash-text-extra-faded">
            Third party apps you have installed and connected to Brimble.
          </p>
          <div className="mt-4">
            <DashButton size="sm">Explore Marketplace</DashButton>
          </div>
        </div>

        {/* Decorative curve — right side */}
        <img
          src="/images/addons-curve.svg"
          alt=""
          className="pointer-events-none absolute right-0 top-0 hidden h-full lg:block dark:brightness-[3]"
        />
      </motion.div>

      {/* Search */}
      <div className="mt-6">
        <div className="relative max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dash-text-extra-faded" />
          <input
            type="text"
            placeholder="Search addons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      {/* Search results */}
      {filtered ? (
        <div className="mt-6">
          <p className="mb-3 text-xs text-dash-text-extra-faded">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </p>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-dash-text-faded">
              No addons match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((addon, i) => (
                <motion.div
                  key={addon.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.04 * i, ease }}
                >
                  <AddonCard addon={addon} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Installed addons */}
          <div className="mt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {installedAddons.map((addon, i) => (
                <motion.div
                  key={addon.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.04 * i, ease }}
                >
                  <AddonCard addon={addon} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Marketplace / available */}
          <div className="mt-8">
            <hr className="mb-6 border-dash-border-soft" />
            <h3 className="mb-4 text-sm font-medium text-dash-text-body">
              Available Addons
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {marketplaceAddons.map((addon, i) => (
                <motion.div
                  key={addon.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: 0.04 * (i + installedAddons.length),
                    ease,
                  }}
                >
                  <AddonCard addon={addon} />
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
