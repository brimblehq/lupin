import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/layout/navbar";
import { ObjectStorageHero } from "@/components/sections/object-storage/hero";
import { ObjectStoragePricing } from "@/components/sections/object-storage/pricing";
import { ObjectStorageCapabilities } from "@/components/sections/object-storage/capabilities";
import { ObjectStorageQuickstart } from "@/components/sections/object-storage/quickstart";
import { ObjectStorageUseCases } from "@/components/sections/object-storage/usecases";
import { ObjectStorageMigrate } from "@/components/sections/object-storage/migrate";
import { Cta } from "@/components/sections/cta";
import { buildSeoHead } from "@/config/seo";

const PAGE_TITLE = "Object Storage";
const PAGE_DESCRIPTION =
  "S3-compatible object storage with no egress fees. Store and serve uploads, static assets, build artifacts, and backups with the SDKs and CLI you already use.";
const PAGE_PATH = "/object-storage";
const PAGE_URL = `https://brimble.io${PAGE_PATH}`;

const objectStorageJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Brimble Object Storage",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  description: PAGE_DESCRIPTION,
  url: PAGE_URL,
  offers: {
    "@type": "Offer",
    url: "https://paper.brimble.io/object-storage/overview",
    priceCurrency: "USD",
    price: "0.032",
    description: "Storage billed at $0.032 per GB-month. Egress and requests are free.",
  },
  provider: {
    "@type": "Organization",
    name: "Brimble",
    url: "https://brimble.io",
  },
};

export const Route = createFileRoute("/object-storage")({
  head: () =>
    buildSeoHead({
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      path: PAGE_PATH,
      jsonLd: objectStorageJsonLd,
    }),
  component: ObjectStoragePage,
});

function ObjectStoragePage() {
  return (
    <div className="min-h-dvh bg-brimble-surface transition-colors duration-300">
      <Navbar />
      <main>
        <ObjectStorageHero />
        <ObjectStoragePricing />
        <ObjectStorageCapabilities />
        <ObjectStorageQuickstart />
        <ObjectStorageUseCases />
        <ObjectStorageMigrate />
        <Cta />
      </main>
    </div>
  );
}
