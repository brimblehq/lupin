import { createContext, useContext } from "react";
import type { DeploymentLog } from "@/backend/deployments";

export type ProjectDeploymentLogsDrawerContextValue = {
  drawerOpen: boolean;
  selectedDeployment: DeploymentLog | null;
  openDeploymentDrawer: (deployment: DeploymentLog) => void;
  closeDeploymentDrawer: () => void;
  syncDeploymentInDrawer: (update: Partial<DeploymentLog> & { id: string }) => void;
};

export const ProjectDeploymentLogsDrawerContext = createContext<ProjectDeploymentLogsDrawerContextValue | null>(null);

export function useProjectDeploymentLogsDrawer() {
  const context = useContext(ProjectDeploymentLogsDrawerContext);
  if (!context) {
    throw new Error("useProjectDeploymentLogsDrawer must be used within ProjectLayout");
  }

  return context;
}
