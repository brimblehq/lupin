import type { TeamMember, TeamDetails } from "@/backend/teams";

export type WorkspaceRole = "Creator" | "Administrator" | "Member" | "Viewer";

export function normalizeMemberRole(member: TeamMember): WorkspaceRole {
  if (member.isCreator) return "Creator";
  const role = (member.role ?? "").toLowerCase();
  if (role.includes("admin")) return "Administrator";
  if (role.includes("creator") || role.includes("owner")) return "Creator";
  if (role.includes("viewer")) return "Viewer";
  return "Member";
}

export function resolveCurrentWorkspaceRole(
  team: TeamDetails | null,
  userId?: string,
  email?: string,
): WorkspaceRole | null {
  if (!team?.members?.length) return null;
  const me = team.members.find((m) => {
    const mUid = m.userId?.trim();
    if (mUid && userId && mUid === userId) return true;
    const mEmail = m.email.trim().toLowerCase();
    return Boolean(email && mEmail === email.trim().toLowerCase());
  });
  return me ? normalizeMemberRole(me) : null;
}
