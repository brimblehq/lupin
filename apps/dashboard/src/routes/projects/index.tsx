import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader } from "../../components/shared/page-header";
import { ProjectCard } from "../../components/shared/project-card";
import type { Project } from "../../components/shared/project-card";

export const Route = createFileRoute("/projects/")({
  component: ProjectsPage,
});

const projects: Project[] = [
  {
    name: "Kemdirimdesign",
    commitMessage: "Merge pull request #40 from Cool-Projects/fix101",
    branch: "master",
    updatedAt: "23h ago",
  },
  {
    name: "Kemdirimdesign",
    commitMessage: "Merge pull request #40 from Cool-Projects/fix101",
    branch: "master",
    updatedAt: "23h ago",
  },
  {
    name: "Kemdirimdesign",
    commitMessage: "Merge pull request #40 from Cool-Projects/fix101",
    branch: "main",
    updatedAt: "2d ago",
  },
  {
    name: "Kemdirimdesign",
    commitMessage: "Merge pull request #40 from Cool-Projects/fix101",
    branch: "main",
    updatedAt: "5d ago",
  },
];

function ProjectsPage() {
  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Projects">
        Welcome to faster frontend deployments! You have used{" "}
        <span className="font-normal text-dash-text-body">4/10</span> of your
        free deployments, you can upgrade to a Pro plan to access unlimited
        deployments.
      </PageHeader>

      <hr className="border-dash-border-soft mb-8 -mx-4 md:-mx-10" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, i) => (
          <ProjectCard key={i} project={project} />
        ))}
        <div
          className="col-span-1 flex items-center sm:col-span-2 justify-center overflow-clip rounded-[4px] border-[0.5px] border-dash-border"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(217,218,221,0.35) 10px, rgba(217,218,221,0.35) 11px)",
          }}
        >
          <Link
            to="/projects/new"
            className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-bg px-4 py-2 text-sm font-medium text-dash-text-body shadow-sm transition-colors hover:bg-dash-bg-elevated"
          >
            <Plus className="size-4" />
            Create new project
          </Link>
        </div>
      </div>
    </div>
  );
}
