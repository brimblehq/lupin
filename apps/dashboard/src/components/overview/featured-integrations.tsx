import { Link } from "@tanstack/react-router";
import { DashButton } from "../shared/dash-button";
import { AddonCard } from "../shared/addon-card";
import type { Addon } from "../shared/addon-card";

export function FeaturedIntegrations({
  addons,
  workspace,
}: {
  addons: Addon[];
  workspace?: string;
}) {
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
        <Link to="/addons" search={workspace ? { workspace } : {}}>
          <DashButton size="sm">Browse</DashButton>
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {addons.map((addon) => (
          <AddonCard key={addon.id} addon={addon} />
        ))}
      </div>
    </div>
  );
}
