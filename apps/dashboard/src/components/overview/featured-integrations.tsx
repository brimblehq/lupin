import { DashButton } from "../shared/dash-button";
import { AddonCard } from "../shared/addon-card";
import type { Addon } from "../shared/addon-card";

const integrations: Addon[] = [
  {
    id: "launchdarkly",
    name: "Launch Darkly",
    description: "Open source Firebase Alternative",
    gradient: "from-[#ea51bd] to-[#f6b2c9]",
    logo: "🚀",
    logoBg: "#3d2c00",
  },
  {
    id: "supabase",
    name: "Supabass",
    description: "Open source Firebase Alternative",
    gradient: "from-[#e9bd4b] to-[#dce94b]",
    logo: "⚡",
    logoBg: "#1a5c2e",
  },
  {
    id: "mongodb",
    name: "MongoDB Atlas",
    description: "Intuitive document-oriented database",
    gradient: "from-[#34a853] to-[#0d6b3e]",
    logo: "🍃",
    logoBg: "#003d22",
  },
];

export function FeaturedIntegrations() {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-dash-text-strong">
            Addons
          </h2>
          <p className="mt-1 max-w-md text-sm text-dash-text-faded">
            Install one of our recommended options below or browse the
            addons marketplace.
          </p>
        </div>
        <DashButton size="sm">Browse</DashButton>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((addon) => (
          <AddonCard key={addon.id} addon={addon} />
        ))}
      </div>
    </div>
  );
}
