/* eslint-disable react-refresh/only-export-components */
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
  isViewer: true,
  canWrite: false,
  canManageMembers: false,
  canEditWorkspace: false,
  canSeeBilling: false,
};

const WorkspaceRoleContext = createContext<WorkspaceRoleValue>(defaultValue);

export function WorkspaceRoleProvider({ value, children }: { value: WorkspaceRoleValue; children: ReactNode }) {
  return <WorkspaceRoleContext value={value}>{children}</WorkspaceRoleContext>;
}

export function useWorkspaceRole(): WorkspaceRoleValue {
  return useContext(WorkspaceRoleContext);
}
