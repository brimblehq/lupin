import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import type { McpServerListResult, McpServerTemplate } from "@/backend/mcp";
import config from "@/config";
import { getServerAccessToken } from "@/server/auth/cookies";

function getServerBackendApi() {
  return createBackendApi({
    baseUrl: config.apiUrl,
    getAccessToken: getServerAccessToken,
  });
}

export const listMcpTemplatesServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        query?: string;
        limit?: number;
        offset?: number;
        cursor?: string;
        category?: string;
        verified?: boolean;
      }
    | undefined;

  return getServerBackendApi().mcp.listTemplates({
    query: payload?.query?.trim() || undefined,
    limit: payload?.limit,
    offset: payload?.offset,
    cursor: payload?.cursor?.trim() || undefined,
    category: payload?.category?.trim() || undefined,
    verified: payload?.verified,
  }) as Promise<McpServerListResult>;
});

export const getMcpTemplateServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { id?: string } | undefined;
  const id = payload?.id?.trim();

  if (!id) {
    throw new Error("MCP template id is required");
  }

  return getServerBackendApi().mcp.getTemplate(id) as Promise<McpServerTemplate | null>;
});

export const deployMcpTemplateServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        workspace?: string;
        template: string;
        templateName: string;
        installationId: number | string;
      }
    | undefined;

  const template = payload?.template?.trim();
  const templateName = payload?.templateName?.trim();
  const installationId = payload?.installationId;

  if (!template) {
    throw new Error("MCP template is required");
  }

  if (!templateName) {
    throw new Error("Template name is required");
  }

  if (
    !(
      typeof installationId === "number" ||
      (typeof installationId === "string" && installationId.trim())
    )
  ) {
    throw new Error("GitHub installation is required");
  }

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();
  let teamId: string | undefined;

  if (workspaceSlug) {
    const teams = await getServerBackendApi().workspaces.list();
    const match = teams.items.find((item) => item.slug === workspaceSlug);
    if (match?.id) {
      teamId = match.id;
    }
  }

  return getServerBackendApi().projects.create({
    git: "github",
    type: "clone",
    clone: {
      name: templateName,
      private: false,
    },
    installationId,
    template,
    serviceType: "mcp",
    ...(teamId ? { teamId } : {}),
  } as any);
});
