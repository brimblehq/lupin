import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/layout/navbar";
import { SandboxHero } from "@/components/sections/sandbox/hero";
import { SandboxProblem } from "@/components/sections/sandbox/problem";
import { SandboxQuickstart } from "@/components/sections/sandbox/quickstart";
import { SandboxFeatures } from "@/components/sections/sandbox/features";
import { SandboxSnapshots } from "@/components/sections/sandbox/snapshots";
import { SandboxStats } from "@/components/sections/sandbox/stats";
import { Cta } from "@/components/sections/cta";
import { buildSeoHead } from "@/config/seo";

const PAGE_TITLE = "Sandboxes";
const PAGE_DESCRIPTION =
  "Isolated, ephemeral compute on demand. Run AI-generated code, untrusted scripts, or per-user workspaces in sandboxes you can pause, snapshot, and destroy.";
const PAGE_PATH = "/sandboxes";
const PAGE_URL = `https://brimble.io${PAGE_PATH}`;

const sandboxJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Brimble Sandboxes",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Linux",
  description: PAGE_DESCRIPTION,
  url: PAGE_URL,
  offers: {
    "@type": "Offer",
    url: "https://brimble.io/pricing",
    priceCurrency: "USD",
    price: "0",
  },
  provider: {
    "@type": "Organization",
    name: "Brimble",
    url: "https://brimble.io",
  },
};

export const Route = createFileRoute("/sandboxes")({
  head: () =>
    buildSeoHead({
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      path: PAGE_PATH,
      jsonLd: sandboxJsonLd,
    }),
  component: SandboxesPage,
});

function SandboxesPage() {
  return (
    <div className="min-h-dvh bg-brimble-surface transition-colors duration-300">
      <Navbar />
      <main>
        <SandboxHero />
        <SandboxProblem />
        <SandboxQuickstart />
        <SandboxFeatures />
        <SandboxSnapshots />
        <SandboxStats />
        <Cta />
      </main>
    </div>
  );
}
