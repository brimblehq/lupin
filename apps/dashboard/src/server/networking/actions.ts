import { createServerFn } from "@tanstack/react-start";
import * as Yup from "yup";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";
import type { XContentTypeOptions, XFrameOptions, XRobotsTag } from "@/backend/networking";

const X_FRAME_VALUES: XFrameOptions[] = ["DENY", "SAMEORIGIN", "disabled"];
const X_CONTENT_TYPE_VALUES: XContentTypeOptions[] = ["nosniff", "disabled"];
const X_ROBOTS_VALUES: XRobotsTag[] = ["index, follow", "noindex, nofollow", "noindex, follow", "index, nofollow", "disabled"];

const projectScopeSchema = Yup.object({
  projectId: Yup.string().trim().required("Project id is required"),
  workspace: Yup.string().trim().optional(),
});

const updateSchema = projectScopeSchema.shape({
  cache: Yup.object({
    purgeOnDeploy: Yup.boolean(),
    bypassCache: Yup.boolean(),
  }).optional(),
  responseRules: Yup.object({
    xFrameOptions: Yup.mixed<XFrameOptions>().oneOf(X_FRAME_VALUES).optional(),
    xContentTypeOptions: Yup.mixed<XContentTypeOptions>().oneOf(X_CONTENT_TYPE_VALUES).optional(),
    xRobotsTag: Yup.mixed<XRobotsTag>().oneOf(X_ROBOTS_VALUES).optional(),
    hstsEnabled: Yup.boolean(),
    markdownForAgents: Yup.boolean(),
  }).optional(),
  firewall: Yup.object({
    pathBlocking: Yup.boolean(),
    browserIntegrityCheck: Yup.boolean(),
    underAttackMode: Yup.boolean(),
  }).optional(),
});

export const getNetworkingSettingsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const { projectId, workspace } = projectScopeSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspace);
    return api.networking.getSettings(projectId, { teamId });
  });
});

export const updateNetworkingSettingsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const { projectId, workspace, cache, responseRules, firewall } = updateSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspace);
    return api.networking.updateSettings(projectId, { cache, responseRules, firewall, teamId });
  });
});

export const purgeNetworkCacheServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const { projectId, workspace } = projectScopeSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspace);
    return api.networking.purgeCache(projectId, { teamId });
  });
});
