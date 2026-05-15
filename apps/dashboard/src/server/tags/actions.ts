import { createServerFn } from "@tanstack/react-start";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";
import { createModuleLogger } from "@/server/shared/logger";

const tagsLogger = createModuleLogger("tags");

export const listTagsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string } | undefined;
  const workspaceSlug = payload?.workspace?.trim().toLowerCase();

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.tags.list({ teamId });
  });
});

export const createTagServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        name: string;
        color: string;
      }
    | undefined;

  if (!payload?.name?.trim()) {
    throw new Error("Tag name is required");
  }

  const workspaceSlug = payload.workspace?.trim().toLowerCase();

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspaceSlug);

    return api.tags.create({
      name: payload.name.trim(),
      color: payload.color,
      teamId,
    });
  });
});

export const updateTagServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        tagId: string;
        name?: string;
        color?: string;
      }
    | undefined;

  const tagId = payload?.tagId?.trim();
  if (!tagId) {
    throw new Error("Tag ID is required");
  }

  return withTokenRefresh((api) =>
    api.tags.update(tagId, {
      name: payload?.name,
      color: payload?.color,
    }),
  );
});

export const deleteTagServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { tagId: string } | undefined;

  const tagId = payload?.tagId?.trim();
  if (!tagId) {
    throw new Error("Tag ID is required");
  }

  return withTokenRefresh(async (api) => {
    await api.tags.remove(tagId);
    return { success: true };
  });
});

export const toggleTagAssignmentServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        tagId: string;
        projectId: string;
      }
    | undefined;

  const tagId = payload?.tagId?.trim();
  const projectId = payload?.projectId?.trim();

  if (!tagId) {
    throw new Error("Tag ID is required");
  }
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  tagsLogger.debug("toggleAssignment:start", { tagId, projectId });
  try {
    const result = await withTokenRefresh((api) => api.tags.toggleAssignment({ tagId, projectId }));
    tagsLogger.debug("toggleAssignment:result", {
      tagId,
      projectId,
      assigned: result?.assigned,
    });
    return result;
  } catch (error) {
    tagsLogger.error("toggleAssignment:error", {
      tagId,
      projectId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});
