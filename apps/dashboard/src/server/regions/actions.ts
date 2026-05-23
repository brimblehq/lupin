import { createServerFn } from "@tanstack/react-start";
import * as Yup from "yup";
import { withTokenRefresh, resolveTeamId } from "@/server/shared/backend";

type ListRegionsPayload = {
  type?: "web" | "database" | "sandbox";
  enabled?: boolean;
  teamId?: string;
  workspace?: string;
};

const listRegionsSchema = Yup.object({
  type: Yup.mixed<"web" | "database" | "sandbox">().oneOf(["web", "database", "sandbox"]),
  enabled: Yup.boolean(),
  teamId: Yup.string().trim(),
  workspace: Yup.string().trim(),
});

export const listRegionsServerFn = createServerFn({
  method: "GET",
}).inputValidator((input: ListRegionsPayload | undefined) => {
  return listRegionsSchema.validateSync(input ?? {}, { stripUnknown: true }) as ListRegionsPayload;
}).handler(async ({ data: payload }) => {

  let teamId = payload?.teamId;
  const workspaceSlug = payload?.workspace?.trim().toLowerCase();

  return withTokenRefresh(async (api) => {
    if (!teamId && workspaceSlug) {
      teamId = await resolveTeamId(api, workspaceSlug);
    }

    return api.regions.list({
      type: payload?.type,
      enabled: payload?.enabled,
      teamId,
    });
  });
});
