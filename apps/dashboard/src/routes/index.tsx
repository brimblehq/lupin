import { createFileRoute } from "@tanstack/react-router";
import { WelcomeSection } from "../components/overview/welcome-section";
import { StatsRow } from "../components/overview/stats-row";
import { DeployedProjects } from "../components/overview/deployed-projects";
import { ConnectedDomains } from "../components/overview/connected-domains";
import { FeaturedIntegrations } from "../components/overview/featured-integrations";

export const Route = createFileRoute("/")({
  component: DashboardHome,
});

function DashboardHome() {
  return (
    <div className="max-w-[1000px]">
      <WelcomeSection />
      <StatsRow />
      <hr className="-mx-4 mb-10 border-dash-border-soft md:-ml-10 md:mr-0" />
      <DeployedProjects />
      <hr className="-mx-4 mb-10 border-dash-border-soft md:-ml-10 md:mr-0" />
      <ConnectedDomains />
      <hr className="-mx-4 mb-10 border-dash-border-soft md:-ml-10 md:mr-0" />
      <FeaturedIntegrations />
    </div>
  );
}
