import { ShieldSlash, Lock, ProhibitInset, ClockCountdown } from "@phosphor-icons/react";
import type { AccessDeniedProps } from "./access-denied";

export const accessDeniedWorkspace = {
  icon: ShieldSlash,
  title: "Not a Workspace Member",
  description: "You don't have access to this workspace. Ask the workspace owner to invite you, or switch to a workspace you belong to.",
  action: { label: "Back to dashboard", href: "/" },
} satisfies Partial<AccessDeniedProps>;

export const accessDeniedProject = {
  icon: Lock,
  title: "Project Access Restricted",
  description: "You don't have permission to view this project. Contact the project owner or a workspace admin for access.",
  action: { label: "View all projects", href: "/projects" },
} satisfies Partial<AccessDeniedProps>;

export const accessDeniedDomain = {
  icon: Lock,
  title: "Domain Access Restricted",
  description: "You don't have permission to manage this domain. Contact the workspace owner for access.",
  action: { label: "View all domains", href: "/domains" },
} satisfies Partial<AccessDeniedProps>;

export const accessDeniedForbidden = {
  icon: ProhibitInset,
  title: "Action Not Allowed",
  description: "Your current role doesn't allow this action. Contact a workspace admin to update your permissions.",
  action: { label: "Back to dashboard", href: "/" },
} satisfies Partial<AccessDeniedProps>;

export const accessDeniedExpired = {
  icon: ClockCountdown,
  title: "Access Expired",
  description: "Your access to this resource has expired. Contact the workspace owner to regain access.",
  action: { label: "Back to dashboard", href: "/" },
} satisfies Partial<AccessDeniedProps>;
