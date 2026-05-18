import type { Project } from "../../components/shared/project-card";
import type { ProjectEnvironment } from "@/backend/environments";

export interface ProjectsRouteLoaderData {
  projects: Project[];
  frameworkLogos: Record<string, string>;
  environments: ProjectEnvironment[];
  pagination: {
    currentPage: number;
    totalPages: number;
    total: number;
    overallTotalProjects?: number;
  };
  workspace?: string;
  environmentId?: string;
  resolvedEnvironmentId?: string;
  requestedEnvironmentAccessDenied?: boolean;
}
