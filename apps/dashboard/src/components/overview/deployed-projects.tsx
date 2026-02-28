import { PageHeader } from "../shared/page-header";
import { ProjectCard } from "../shared/project-card";
import type { Project } from "../shared/project-card";
import { CreateProjectCard } from "../shared/create-project-card";
import { usePlanGate } from "@/hooks/use-plan-gate";

function getCreateCardSpan(projectCount: number) {
  const smRemaining = projectCount % 2 === 0 ? 2 : 2 - (projectCount % 2);
  const lgRemaining = projectCount % 3 === 0 ? 3 : 3 - (projectCount % 3);

  return [
    smRemaining >= 2 ? "sm:col-span-2" : "",
    lgRemaining >= 3 ? "lg:col-span-3" : lgRemaining >= 2 ? "lg:col-span-2" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function DeployedProjects({
  projects,
  totalProjects,
  isTeamWorkspace,
}: {
  projects: Project[];
  totalProjects?: number;
  isTeamWorkspace?: boolean;
}) {
  const { projectLimit } = usePlanGate();
  const usageCopy = getProjectsUsageCopy({
    totalProjects: totalProjects ?? projects.length,
    projectLimit,
    isTeamWorkspace,
  });

  return (
    <div className="mb-8">
      <PageHeader title="Deployed projects">
        {usageCopy}
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, i) => (
          <ProjectCard key={i} project={project} />
        ))}
        <CreateProjectCard className={getCreateCardSpan(projects.length)} />
      </div>
    </div>
  );
}

function getProjectsUsageCopy({
  totalProjects,
  projectLimit,
  isTeamWorkspace,
}: {
  totalProjects: number;
  projectLimit: number | null;
  isTeamWorkspace?: boolean;
}) {
  if (isTeamWorkspace) {
    return `Manage your projects from one place. Your team currently has ${totalProjects} project${totalProjects === 1 ? "" : "s"}.`;
  }

  if (projectLimit === null) {
    return `Manage your projects from one place. You currently have ${totalProjects} project${totalProjects === 1 ? "" : "s"} on your plan.`;
  }

  return (
    <>
      Manage your apps, APIs, workers, and databases from one place. You have used{" "}
      <span className="font-semibold text-dash-text-body">
        {Math.min(totalProjects, projectLimit)}/{projectLimit}
      </span>{" "}
      projects on your current plan. Upgrade to Pro for unlimited projects.
    </>
  );
}
