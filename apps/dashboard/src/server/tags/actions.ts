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

export const listTagsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string } | undefined;
  const workspaceSlug = payload?.workspace?.trim().toLowerCase();

  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  return getServerBackendApi().tags.list({ teamId });
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
  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  return getServerBackendApi().tags.create({
    name: payload.name.trim(),
    color: payload.color,
    teamId,
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

  return getServerBackendApi().tags.update(tagId, {
    name: payload?.name,
    color: payload?.color,
  });
});

export const deleteTagServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { tagId: string } | undefined;

  const tagId = payload?.tagId?.trim();
  if (!tagId) {
    throw new Error("Tag ID is required");
  }

  await getServerBackendApi().tags.remove(tagId);
  return { success: true };
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

  return getServerBackendApi().tags.toggleAssignment({ tagId, projectId });
});
