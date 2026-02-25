import type { ApiClient } from "./types";
import {
  asBoolean,
  asRecord,
  asStringOrNumber,
  pickBoolean,
  pickNonEmptyString,
  pickString,
} from "./normalize";

export interface TeamMember {
  id: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email: string;
  role?: string;
  accepted?: boolean;
  avatarUrl?: string;
  isCreator?: boolean;
  permissions?: unknown[];
  invitedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamDetails {
  id: string;
  name: string;
  avatarUrl?: string;
  isCreator?: boolean;
  subscriptionId?: string;
  members: TeamMember[];
}

export interface TeamsApi {
  getByName(teamName: string): Promise<TeamDetails>;
  inviteMembers(input: {
    teamId: string;
    members: string[];
    resend?: boolean;
  }): Promise<{ ok: true }>;
  removeMember(teamId: string, memberId: string): Promise<{ ok: true }>;
}

function mapTeamMember(item: unknown): TeamMember | null {
  const row = asRecord(item);
  if (!row) return null;

  const email = pickNonEmptyString(row, "email");
  if (!email) return null;

  const profileRow = asRecord(row.profile);
  const userRow = asRecord(row.user);

  return {
    id:
      String(
        asStringOrNumber(row.id) ??
        asStringOrNumber(row._id) ??
        asStringOrNumber(row.memberId) ??
        email,
      ),
    userId:
      pickString(row, "userId", "authId") ??
      pickString(userRow, "id", "_id"),
    firstName:
      pickString(row, "firstName") ??
      pickString(profileRow, "firstName") ??
      pickString(userRow, "firstName"),
    lastName:
      pickString(row, "lastName") ??
      pickString(profileRow, "lastName") ??
      pickString(userRow, "lastName"),
    username:
      pickString(row, "username") ??
      pickString(profileRow, "username") ??
      pickString(userRow, "username"),
    email,
    role: pickString(row, "role"),
    accepted: pickBoolean(row, "accepted"),
    avatarUrl:
      pickString(row, "avatar", "avatarUrl", "avatar_url") ??
      pickString(profileRow, "avatar", "avatarUrl", "avatar_url") ??
      pickString(userRow, "avatar", "avatarUrl", "avatar_url"),
    isCreator:
      pickBoolean(row, "isCreator") ??
      asBoolean(row.creator),
    permissions: Array.isArray(row.permissions) ? row.permissions : undefined,
    invitedAt: pickString(row, "invitedAt"),
    createdAt: pickString(row, "createdAt"),
    updatedAt: pickString(row, "updatedAt"),
  };
}

function extractTeamRoot(response: any) {
  return response?.data?.data ?? response?.data ?? response ?? {};
}

export function createTeamsApi(client: ApiClient): TeamsApi {
  return {
    async getByName(teamName) {
      const response = await client.request<any>(`/core/v1/teams/${encodeURIComponent(teamName)}`, {
        method: "GET",
      });

      const root = asRecord(extractTeamRoot(response)) ?? {};
      const rawMembers = Array.isArray(root.members) ? root.members : [];

      return {
        id: String(asStringOrNumber(root.id) ?? asStringOrNumber(root._id) ?? ""),
        name: pickString(root, "name") ?? teamName,
        avatarUrl: pickString(root, "avatar", "avatarUrl", "avatar_url"),
        isCreator: pickBoolean(root, "isCreator"),
        subscriptionId:
          pickString(asRecord(root.subscription), "_id", "id") ??
          pickString(root, "subscriptionId", "subscription_id"),
        members: rawMembers
          .map(mapTeamMember)
          .filter((member): member is TeamMember => member !== null),
      };
    },

    async inviteMembers(input) {
      await client.request<any>(
        `/core/v1/teams/${encodeURIComponent(input.teamId)}/invite${input.resend ? "/resend" : ""}`,
        {
          method: "POST",
          body: {
            members: input.members,
          },
        },
      );

      return { ok: true } as const;
    },

    async removeMember(teamId, memberId) {
      await client.request<any>(
        `/core/v1/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}/remove`,
        {
          method: "POST",
          body: {},
        },
      );

      return { ok: true } as const;
    },
  };
}
