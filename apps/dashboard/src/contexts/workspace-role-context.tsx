import { createContext, useContext, type ReactNode } from "react";
import type { WorkspaceRole } from "@/utils/workspace-role";

interface WorkspaceRoleValue {
  role: WorkspaceRole | null;
  isViewer: boolean;
  canWrite: boolean;
  canManageMembers: boolean;
  canEditWorkspace: boolean;
  canSeeBilling: boolean;
}

const defaultValue: WorkspaceRoleValue = {
  role: null,
  isViewer: false,
  canWrite: true,
  canManageMembers: true,
  canEditWorkspace: true,
  canSeeBilling: true,
};

const WorkspaceRoleContext = createContext<WorkspaceRoleValue>(defaultValue);

export function WorkspaceRoleProvider({
  value,
  children,
}: {
  value: WorkspaceRoleValue;
  children: ReactNode;
}) {
  return <WorkspaceRoleContext value={value}>{children}</WorkspaceRoleContext>;
}

export function useWorkspaceRole(): WorkspaceRoleValue {
  return useContext(WorkspaceRoleContext);
}
