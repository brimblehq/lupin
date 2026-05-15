import type { ApiClient } from "./types";
import { asBoolean, asRecord, asStringOrNumber, pickBoolean, pickNumber, pickNonEmptyString, pickString } from "./normalize";

export interface MemberPermission {
  id: string;
  permissionId?: string;
  enabled: boolean;
  permission?: {
    title?: string;
    type?: string;
    role?: string;
  };
}

export interface TeamMemberEnvironment {
  _id: string;
  name: string;
  slug: string;
  isDefault: boolean;
}

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
  is2FACompliant?: boolean;
  permissions?: MemberPermission[];
  project_environments?: TeamMemberEnvironment[];
  invitedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamDetails {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  createdAt?: string;
  buildDisabled?: boolean;
  buildDisabledBy?: string | null;
  spendingLimit?: number | null;
  seatCount?: number;
  totalMembers?: number;
  concurrentBuilds?: number;
  isCreator?: boolean;
  enforce2FA?: boolean;
  subscriptionId?: string;
  subscriptionType?: string;
  subscriptionStatus?: string;
  members: TeamMember[];
}

export interface TeamInvitation {
  id: string;
  invitedBy?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
    username?: string;
  };
  team: { id: string; name: string; avatar?: string; description?: string; enforce2FA?: boolean };
}

export interface TeamOwnershipTransfer {
  id: string;
  teamId?: string;
  fromUserId?: string;
  toUserId?: string;
  status?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamsApi {
  getByName(teamName: string): Promise<TeamDetails>;
  update(
    teamId: string,
    input: {
      name?: string;
      description?: string;
      avatarUrl?: string;
    },
  ): Promise<{ ok: true }>;
  inviteMembers(input: { teamId: string; members: string[]; resend?: boolean }): Promise<{ ok: true }>;
  removeMember(teamId: string, memberId: string): Promise<{ ok: true }>;
  updateMemberEnvironments(teamId: string, memberId: string, input: { project_environments?: string[] }): Promise<{ ok: true }>;
  updateMemberRole(teamId: string, memberId: string, role: string): Promise<{ ok: true }>;
  checkInvitation(teamName: string): Promise<TeamInvitation>;
  acceptInvite(teamId: string): Promise<{ ok: true }>;
  denyInvite(teamId: string): Promise<{ ok: true }>;
  transferOwnership(teamId: string, newOwnerId: string): Promise<TeamOwnershipTransfer>;
  acceptOwnershipTransfer(teamId: string): Promise<TeamOwnershipTransfer>;
  denyOwnershipTransfer(teamId: string): Promise<TeamOwnershipTransfer>;
  toggleTwoFactorEnforcement(teamId: string, enforce: boolean): Promise<{ id: string; enforce2FA: boolean }>;
}

function mapTeamMember(item: unknown): TeamMember | null {
  const row = asRecord(item);
  if (!row) return null;

  const email = pickNonEmptyString(row, "email");
  if (!email) return null;

  const profileRow = asRecord(row.profile);
  const userRow = asRecord(row.user);

  return {
    id: String(asStringOrNumber(row.id) ?? asStringOrNumber(row._id) ?? asStringOrNumber(row.memberId) ?? email),
    userId: pickString(row, "userId", "authId") ?? pickString(userRow, "id", "_id"),
    firstName: pickString(row, "firstName") ?? pickString(profileRow, "firstName") ?? pickString(userRow, "firstName"),
    lastName: pickString(row, "lastName") ?? pickString(profileRow, "lastName") ?? pickString(userRow, "lastName"),
    username: pickString(row, "username") ?? pickString(profileRow, "username") ?? pickString(userRow, "username"),
    email,
    role: pickString(row, "role"),
    accepted: pickBoolean(row, "accepted"),
    avatarUrl:
      pickString(row, "avatar", "avatarUrl", "avatar_url") ??
      pickString(profileRow, "avatar", "avatarUrl", "avatar_url") ??
      pickString(userRow, "avatar", "avatarUrl", "avatar_url"),
    isCreator: pickBoolean(row, "isCreator") ?? asBoolean(row.creator),
    is2FACompliant: pickBoolean(row, "is2FACompliant", "is_2fa_compliant"),
    permissions: Array.isArray(row.permissions)
      ? row.permissions
          .map((p: unknown): MemberPermission | null => {
            const pr = asRecord(p);
            if (!pr) return null;
            const permRow = asRecord(pr.permission);
            return {
              id: String(asStringOrNumber(pr.id) ?? asStringOrNumber(pr._id) ?? ""),
              permissionId: pickString(pr, "permissionId"),
              enabled: pickBoolean(pr, "enabled") ?? true,
              permission: permRow
                ? {
                    title: pickString(permRow, "title"),
                    type: pickString(permRow, "type"),
                    role: pickString(permRow, "role"),
                  }
                : undefined,
            };
          })
          .filter((p): p is MemberPermission => p !== null)
      : undefined,
    project_environments: Array.isArray(row.project_environments)
      ? row.project_environments
          .map((e: unknown): TeamMemberEnvironment | null => {
            const er = asRecord(e);
            if (!er) return null;
            return {
              _id: String(asStringOrNumber(er._id) ?? asStringOrNumber(er.id) ?? ""),
              name: pickString(er, "name") ?? "",
              slug: pickString(er, "slug") ?? "",
              isDefault: pickBoolean(er, "isDefault") ?? false,
            };
          })
          .filter((e): e is TeamMemberEnvironment => e !== null)
      : undefined,
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
      const subscriptionRow = asRecord(root.subscription);
      const subscriptionSpecs = asRecord(subscriptionRow?.specifications) ?? asRecord(root.specifications);
      const rawMembers = Array.isArray(root.members) ? root.members : [];

      return {
        id: String(asStringOrNumber(root.id) ?? asStringOrNumber(root._id) ?? ""),
        name: pickString(root, "name") ?? teamName,
        description: pickString(root, "description") || undefined,
        avatarUrl: pickString(root, "avatar", "avatarUrl", "avatar_url"),
        createdAt: pickString(subscriptionRow, "created_at", "createdAt") ?? pickString(root, "createdAt", "created_at") ?? undefined,
        buildDisabled: pickBoolean(root, "build_disabled", "buildDisabled"),
        buildDisabledBy: pickString(root, "build_disabled_by", "buildDisabledBy") ?? null,
        spendingLimit: root.spending_limit === null || root.spending_limit === undefined ? null : Number(root.spending_limit),
        seatCount: pickNumber(root, "size") ?? pickNumber(subscriptionSpecs, "members", "member_count", "seats"),
        totalMembers: pickNumber(root, "totalMembers", "total_members"),
        concurrentBuilds: pickNumber(subscriptionSpecs, "concurrent_builds", "concurrentBuilds", "builds"),
        isCreator: pickBoolean(root, "isCreator"),
        enforce2FA: pickBoolean(root, "enforce2FA", "enforce_2fa") ?? false,
        subscriptionId: pickString(asRecord(root.subscription), "_id", "id") ?? pickString(root, "subscriptionId", "subscription_id"),
        subscriptionType: pickString(subscriptionRow, "type", "plan_type", "planType") ?? undefined,
        subscriptionStatus: pickString(subscriptionRow, "stripe_status", "status") ?? undefined,
        members: rawMembers.map(mapTeamMember).filter((member): member is TeamMember => member !== null),
      };
    },

    async update(teamId, input) {
      await client.request<any>(`/core/v1/teams/${encodeURIComponent(teamId)}`, {
        method: "PATCH",
        body: {
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
          ...(typeof input.description === "string" ? { description: input.description.trim() || null } : {}),
          ...(typeof input.avatarUrl === "string" ? { avatar: input.avatarUrl.trim() || null } : {}),
        },
      });

      return { ok: true } as const;
    },

    async inviteMembers(input) {
      await client.request<any>(`/core/v1/teams/${encodeURIComponent(input.teamId)}/invite${input.resend ? "/resend" : ""}`, {
        method: "POST",
        body: {
          members: input.members,
        },
      });

      return { ok: true } as const;
    },

    async removeMember(teamId, memberId) {
      await client.request<any>(`/core/v1/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}/remove`, {
        method: "POST",
        body: {},
      });

      return { ok: true } as const;
    },

    async updateMemberRole(teamId, memberId, role) {
      await client.request<any>(`/core/v1/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}/role`, {
        method: "PUT",
        body: { role },
      });

      return { ok: true } as const;
    },

    async updateMemberEnvironments(teamId, memberId, input) {
      await client.request<any>(`/core/v1/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}/environments`, {
        method: "PUT",
        body: {
          ...(input.project_environments ? { project_environments: input.project_environments } : {}),
        },
      });

      return { ok: true } as const;
    },

    async checkInvitation(teamName) {
      const response = await client.request<any>(`/core/v1/teams/${encodeURIComponent(teamName)}/invitation`, { method: "GET" });

      const root = asRecord(extractTeamRoot(response)) ?? {};
      const invitedByRow = asRecord(root.invitedBy);
      const teamRow = asRecord(root.team) ?? {};

      return {
        id: String(asStringOrNumber(root.id) ?? asStringOrNumber(root._id) ?? ""),
        invitedBy: invitedByRow
          ? {
              id: pickString(invitedByRow, "id", "_id"),
              firstName: pickString(invitedByRow, "firstName"),
              lastName: pickString(invitedByRow, "lastName"),
              email: pickString(invitedByRow, "email"),
              avatar: pickString(invitedByRow, "avatar", "avatarUrl"),
              username: pickString(invitedByRow, "username"),
            }
          : undefined,
        team: {
          id: String(asStringOrNumber(teamRow.id) ?? asStringOrNumber(teamRow._id) ?? ""),
          name: pickString(teamRow, "name") ?? teamName,
          avatar: pickString(teamRow, "avatar", "avatarUrl"),
          description: pickString(teamRow, "description"),
          enforce2FA: pickBoolean(teamRow, "enforce2FA", "enforce_2fa") ?? false,
        },
      } satisfies TeamInvitation;
    },

    async acceptInvite(teamId) {
      await client.request<any>(`/core/v1/teams/${encodeURIComponent(teamId)}/accept`, { method: "POST", body: {} });

      return { ok: true } as const;
    },

    async denyInvite(teamId) {
      await client.request<any>(`/core/v1/teams/${encodeURIComponent(teamId)}/deny`, { method: "POST", body: {} });

      return { ok: true } as const;
    },

    async transferOwnership(teamId, newOwnerId) {
      const response = await client.request<any>(`/core/v1/teams/${encodeURIComponent(teamId)}/transfer-ownership`, {
        method: "POST",
        body: {
          memberId: newOwnerId,
        },
      });

      const root = asRecord(extractTeamRoot(response)) ?? {};
      return {
        id: String(asStringOrNumber(root._id) ?? asStringOrNumber(root.id) ?? ""),
        teamId: pickString(root, "team", "teamId", "team_id"),
        fromUserId: pickString(root, "from_user", "fromUser", "from_user_id"),
        toUserId: pickString(root, "to_user", "toUser", "to_user_id"),
        status: pickString(root, "status"),
        expiresAt: pickString(root, "expires_at", "expiresAt"),
        createdAt: pickString(root, "createdAt", "created_at"),
        updatedAt: pickString(root, "updatedAt", "updated_at"),
      } satisfies TeamOwnershipTransfer;
    },

    async acceptOwnershipTransfer(teamId) {
      const response = await client.request<any>(`/core/v1/teams/${encodeURIComponent(teamId)}/accept-transfer`, {
        method: "POST",
        body: {},
      });
      const root = asRecord(extractTeamRoot(response)) ?? {};
      return {
        id: String(asStringOrNumber(root._id) ?? asStringOrNumber(root.id) ?? ""),
        teamId: pickString(root, "team", "teamId", "team_id"),
        fromUserId: pickString(root, "from_user", "fromUser", "from_user_id"),
        toUserId: pickString(root, "to_user", "toUser", "to_user_id"),
        status: pickString(root, "status"),
        expiresAt: pickString(root, "expires_at", "expiresAt"),
        createdAt: pickString(root, "createdAt", "created_at"),
        updatedAt: pickString(root, "updatedAt", "updated_at"),
      } satisfies TeamOwnershipTransfer;
    },

    async denyOwnershipTransfer(teamId) {
      const response = await client.request<any>(`/core/v1/teams/${encodeURIComponent(teamId)}/deny-transfer`, {
        method: "POST",
        body: {},
      });
      const root = asRecord(extractTeamRoot(response)) ?? {};
      return {
        id: String(asStringOrNumber(root._id) ?? asStringOrNumber(root.id) ?? ""),
        teamId: pickString(root, "team", "teamId", "team_id"),
        fromUserId: pickString(root, "from_user", "fromUser", "from_user_id"),
        toUserId: pickString(root, "to_user", "toUser", "to_user_id"),
        status: pickString(root, "status"),
        expiresAt: pickString(root, "expires_at", "expiresAt"),
        createdAt: pickString(root, "createdAt", "created_at"),
        updatedAt: pickString(root, "updatedAt", "updated_at"),
      } satisfies TeamOwnershipTransfer;
    },

    async toggleTwoFactorEnforcement(teamId, enforce) {
      const response = await client.request<any>(`/core/v1/teams/${encodeURIComponent(teamId)}/security/2fa`, {
        method: "PATCH",
        body: { enforce },
      });

      const root = asRecord(extractTeamRoot(response)) ?? {};
      return {
        id: String(asStringOrNumber(root.id) ?? asStringOrNumber(root._id) ?? teamId),
        enforce2FA: pickBoolean(root, "enforce2FA", "enforce_2fa") ?? enforce,
      };
    },
  };
}
