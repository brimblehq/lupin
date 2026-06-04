import { createServerFn } from "@tanstack/react-start";
import * as Yup from "yup";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";

const KEY_PATTERN = /^(ip\.src|cf\..+|http\..+)$/;
const PATH_PATTERN = /^(?!\w+:\/\/)\S+$/;
const WINDOW_PATTERN = /^\d+s$/;

const projectScopeSchema = Yup.object({
  projectId: Yup.string().trim().required("Project id is required"),
  workspace: Yup.string().trim().optional(),
});

const zoneSchema = Yup.object({
  name: Yup.string().trim().required("Each rule needs a name"),
  key: Yup.string().trim().required().matches(KEY_PATTERN, "Key must be ip.src or start with cf. or http."),
  window: Yup.string().required("Pick a supported window").matches(WINDOW_PATTERN, "Invalid window"),
  events: Yup.number().integer().min(1, "Limit must be at least 1").required(),
  matcher: Yup.object({
    methods: Yup.array().of(Yup.string().required()).optional(),
    paths: Yup.array().of(Yup.string().required().matches(PATH_PATTERN, "Paths can't contain spaces or a full URL")).optional(),
  }).optional(),
  ipv4Prefix: Yup.number().integer().min(0).max(32).optional(),
  ipv6Prefix: Yup.number().integer().min(0).max(128).optional(),
});

const updateSchema = projectScopeSchema.shape({
  enabled: Yup.boolean().optional(),
  zones: Yup.array().of(zoneSchema).optional(),
});

export const getRatelimitSettingsServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const { projectId, workspace } = projectScopeSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspace);
    return api.ratelimits.getSettings(projectId, { teamId });
  });
});

export const updateRatelimitSettingsServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const { projectId, workspace, enabled, zones } = updateSchema.validateSync(data, { stripUnknown: true });

  return withTokenRefresh(async (api) => {
    const teamId = await resolveTeamId(api, workspace);
    return api.ratelimits.updateSettings(projectId, { enabled, zones, teamId });
  });
});

export const getRatelimitOptionsServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withTokenRefresh((api) => api.ratelimits.getOptions());
});
