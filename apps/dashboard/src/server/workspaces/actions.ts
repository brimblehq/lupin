import { createServerFn } from "@tanstack/react-start";
import { withTokenRefresh } from "@/server/shared/backend";
import { workspacesLogger } from "@/server/shared/logger";

export const listWorkspacesServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withTokenRefresh((api) => api.workspaces.list());
});

export const verifyWorkspacePromoCodeServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { code?: string } | undefined;
  const code = payload?.code?.trim();
  if (!code) {
    throw new Error("Promo code is required");
  }

  return withTokenRefresh((api) => api.workspaces.verifyStartupCode(code));
});

export const createWorkspaceServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        team_name?: string;
        type?: "TEAM_PLAN";
        members?: string[];
        image?: string | null;
        startup_code_reference?: string;
        specifications?: {
          members?: number;
          concurrent_builds?: number;
        };
        accept_terms?: boolean;
        payment_method?: string;
      }
    | undefined;

  const teamName = payload?.team_name?.trim();
  if (!teamName) {
    throw new Error("Workspace name is required");
  }

  const memberCount = payload?.specifications?.members;
  const concurrentBuilds = payload?.specifications?.concurrent_builds;
  if (typeof memberCount !== "number" || !Number.isFinite(memberCount) || memberCount < 1) {
    throw new Error("Team size is invalid");
  }
  if (typeof concurrentBuilds !== "number" || !Number.isFinite(concurrentBuilds) || concurrentBuilds < 2) {
    throw new Error("Concurrent builds is invalid");
  }

  const members = Array.isArray(payload?.members) ? payload!.members.filter((member): member is string => typeof member === "string") : [];
  const image = payload?.image?.trim() || null;

  const body = {
    team_name: teamName,
    type: "TEAM_PLAN" as const,
    members,
    image,
    startup_code_reference: payload?.startup_code_reference?.trim() ?? "",
    specifications: {
      members: Math.floor(memberCount),
      concurrent_builds: Math.floor(concurrentBuilds),
    },
    accept_terms: payload?.accept_terms !== false,
    ...(payload?.payment_method ? { payment_method: payload.payment_method } : {}),
  };
  workspacesLogger.debug("createWorkspace request body:", body);
  return withTokenRefresh(async (api) => {
    try {
      return await api.workspaces.create(body);
    } catch (err: any) {
      workspacesLogger.error("createWorkspace failed:", err);
      throw err;
    }
  });
});
