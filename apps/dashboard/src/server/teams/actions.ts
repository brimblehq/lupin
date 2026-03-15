import { createServerFn } from "@tanstack/react-start";
import type { BackendApi } from "@/backend";
import { withTokenRefresh } from "@/server/shared/backend";
import { teamsLogger } from "@/server/shared/logger";

async function resolveWorkspaceTeam(api: BackendApi, workspace?: string) {
  const workspaceSlug = workspace?.trim().toLowerCase();
  if (!workspaceSlug) {
    throw new Error("Workspace is required");
  }

  const teams = await api.workspaces.list();
  const match = teams.items.find((item) => item.slug === workspaceSlug);

  if (!match?.id || !match.slug) {
    throw new Error("Workspace team not found");
  }

  return {
    teamId: match.id,
    teamName: match.slug,
  };
}

export const getWorkspaceTeamMembersServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string } | undefined;
  return withTokenRefresh(async (api) => {
    const { teamId, teamName } = await resolveWorkspaceTeam(api, payload?.workspace);

    try {
      const team = await api.teams.getByName(teamName);
      teamsLogger.info(
        `getWorkspaceTeamMembersServerFn response (workspace=${payload?.workspace ?? "unknown"}, lookup=slug:${teamName}):\n${JSON.stringify(team, null, 2)}`,
      );
      return team;
    } catch {
      const team = await api.teams.getByName(teamId);
      teamsLogger.info(
        `getWorkspaceTeamMembersServerFn response (workspace=${payload?.workspace ?? "unknown"}, lookup=id:${teamId}):\n${JSON.stringify(team, null, 2)}`,
      );
      return team;
    }
  });
});

export const inviteWorkspaceTeamMembersServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        members?: string[];
      }
    | undefined;

  const members = Array.isArray(payload?.members)
    ? payload.members
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
    : [];

  if (!members.length) {
    throw new Error("At least one email is required");
  }

  return withTokenRefresh(async (api) => {
    const { teamId } = await resolveWorkspaceTeam(api, payload?.workspace);
    return api.teams.inviteMembers({ teamId, members });
  });
});

export const updateWorkspaceTeamProfileServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        name?: string;
        description?: string;
        avatarUrl?: string;
      }
    | undefined;

  const name = payload?.name?.trim();

  if (!name) {
    throw new Error("Workspace name is required");
  }

  return withTokenRefresh(async (api) => {
    const { teamId } = await resolveWorkspaceTeam(api, payload?.workspace);
    return api.teams.update(teamId, {
      name,
      description: payload?.description,
      avatarUrl: payload?.avatarUrl,
    });
  });
});

export const resendWorkspaceTeamInviteServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        email?: string;
      }
    | undefined;

  const email = typeof payload?.email === "string" ? payload.email.trim() : "";
  if (!email) {
    throw new Error("Invite email is required");
  }

  return withTokenRefresh(async (api) => {
    const { teamId } = await resolveWorkspaceTeam(api, payload?.workspace);
    return api.teams.inviteMembers({
      teamId,
      members: [email],
      resend: true,
    });
  });
});

export const updateMemberRoleServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        memberId?: string;
        role?: string;
      }
    | undefined;

  const memberId = payload?.memberId?.trim();
  if (!memberId) {
    throw new Error("Member ID is required");
  }

  const role = payload?.role?.trim();
  if (!role) {
    throw new Error("Role is required");
  }

  return withTokenRefresh(async (api) => {
    const { teamId } = await resolveWorkspaceTeam(api, payload?.workspace);
    return api.teams.updateMemberRole(teamId, memberId, role);
  });
});

export const updateMemberEnvironmentsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        memberId?: string;
        project_environments?: string[];
      }
    | undefined;

  const memberId = payload?.memberId?.trim();
  if (!memberId) {
    throw new Error("Member ID is required");
  }

  const projectEnvironments = Array.isArray(payload?.project_environments)
    ? payload.project_environments
    : undefined;

  return withTokenRefresh(async (api) => {
    const { teamId } = await resolveWorkspaceTeam(api, payload?.workspace);
    return api.teams.updateMemberEnvironments(teamId, memberId, {
      project_environments: projectEnvironments,
    });
  });
});

export const removeWorkspaceTeamMemberServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        memberId?: string;
      }
    | undefined;

  const memberId = typeof payload?.memberId === "string" ? payload.memberId.trim() : "";
  if (!memberId) {
    throw new Error("Member ID is required");
  }

  return withTokenRefresh(async (api) => {
    const { teamId } = await resolveWorkspaceTeam(api, payload?.workspace);
    return api.teams.removeMember(teamId, memberId);
  });
});

export const transferOwnershipServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        memberId?: string;
      }
    | undefined;

  const memberId = payload?.memberId?.trim();
  if (!memberId) {
    throw new Error("Member ID is required");
  }

  return withTokenRefresh(async (api) => {
    const { teamId } = await resolveWorkspaceTeam(api, payload?.workspace);
    return api.teams.transferOwnership(teamId, memberId);
  });
});

export const checkTeamInvitationServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string } | undefined;
  const teamName = payload?.workspace?.trim().toLowerCase();
  if (!teamName) {
    throw new Error("Workspace is required");
  }
  return withTokenRefresh(async (api) => {
    return api.teams.checkInvitation(teamName);
  });
});

export const acceptTeamInvitationServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { teamId?: string } | undefined;
  const teamId = payload?.teamId?.trim();
  if (!teamId) {
    throw new Error("Team ID is required");
  }
  return withTokenRefresh(async (api) => {
    return api.teams.acceptInvite(teamId);
  });
});

export const declineTeamInvitationServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { teamId?: string } | undefined;
  const teamId = payload?.teamId?.trim();
  if (!teamId) {
    throw new Error("Team ID is required");
  }
  return withTokenRefresh(async (api) => {
    return api.teams.denyInvite(teamId);
  });
});
