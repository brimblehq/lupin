import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import config from "@/config";
import { getServerAccessToken } from "@/server/auth/cookies";

function getServerBackendApi() {
  return createBackendApi({
    baseUrl: config.apiUrl,
    getAccessToken: getServerAccessToken,
  });
}

async function resolveWorkspaceTeam(workspace?: string) {
  const workspaceSlug = workspace?.trim().toLowerCase();
  if (!workspaceSlug) {
    throw new Error("Workspace is required");
  }

  const api = getServerBackendApi();
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
  const { teamId, teamName } = await resolveWorkspaceTeam(payload?.workspace);
  const api = getServerBackendApi();

  try {
    return await api.teams.getByName(teamName);
  } catch {
    return api.teams.getByName(teamId);
  }
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

  const { teamId } = await resolveWorkspaceTeam(payload?.workspace);
  return getServerBackendApi().teams.inviteMembers({ teamId, members });
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

  const { teamId } = await resolveWorkspaceTeam(payload?.workspace);
  return getServerBackendApi().teams.inviteMembers({
    teamId,
    members: [email],
    resend: true,
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

  const { teamId } = await resolveWorkspaceTeam(payload?.workspace);
  return getServerBackendApi().teams.removeMember(teamId, memberId);
});
