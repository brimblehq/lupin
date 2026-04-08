import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { TabHeader } from "../../../components/shared/tab-header";
import { shouldShowProjectWebAnalyticsTab } from "@/utils/project-capabilities";
import { AppAnalytics } from "./observability";

const parentRoute = getRouteApi("/projects/$projectId");

export const Route = createFileRoute("/projects/$projectId/web-analytics")({
  component: WebAnalyticsPage,
});

function WebAnalyticsPage() {
  const { project } = parentRoute.useLoaderData() as any;

  if (!shouldShowProjectWebAnalyticsTab(project)) {
    return (
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4 px-4 py-8 sm:px-0">
        <TabHeader title="Web analytics">
          Web analytics is not available for this project type.
        </TabHeader>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-0">
      <AppAnalytics />
    </div>
  );
}
