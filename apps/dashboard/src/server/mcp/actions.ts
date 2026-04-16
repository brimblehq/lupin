import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import type { McpServerListResult, McpServerTemplate } from "@/backend/mcp";
import serverConfig from "@/config/server";
import { withTokenRefresh } from "@/server/shared/backend";
import { mcpLogger } from "@/server/shared/logger";

function getPublicBackendApi() {
  return createBackendApi({
    baseUrl: serverConfig.apiUrl,
    signatureSecret: serverConfig.hmacSecretKey,
    apiKey: serverConfig.apiKey,
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

  const request = {
    query: payload?.query?.trim() || undefined,
    limit: payload?.limit,
    offset: payload?.offset,
    cursor: payload?.cursor?.trim() || undefined,
    category: payload?.category?.trim() || undefined,
    verified: payload?.verified,
  } as const;

  try {
    return await withTokenRefresh((api) => api.mcp.listTemplates(request) as Promise<McpServerListResult>);
  } catch (error) {
    mcpLogger.debug("listMcpTemplates: auth-backed request failed, retrying without auth", error);

    return getPublicBackendApi().mcp.listTemplates(request) as Promise<McpServerListResult>;
  }
});

export const listRecommendedMcpTemplatesServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as
    | {
        limit?: number;
        category?: string;
        officialOnly?: boolean;
        shuffle?: boolean;
        provider?: "smithery" | "pulsemcp" | "auto";
      }
    | undefined;

  const request = {
    limit: payload?.limit,
    category: payload?.category?.trim() || undefined,
    officialOnly: payload?.officialOnly,
    shuffle: payload?.shuffle,
    provider: payload?.provider,
  } as const;

  try {
    return await withTokenRefresh((api) => api.mcp.listRecommendedTemplates(request) as Promise<McpServerListResult>);
  } catch (error) {
    mcpLogger.debug("listRecommendedMcpTemplates: auth-backed request failed, retrying without auth", error);

    return getPublicBackendApi().mcp.listRecommendedTemplates(request) as Promise<McpServerListResult>;
  }
});

export const getMcpTemplateServerFn = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  const payload = data as { id?: string } | undefined;
  const id = payload?.id?.trim();

  if (!id) {
    throw new Error("MCP template id is required");
  }

  const result = await withTokenRefresh((api) => api.mcp.getTemplate(id) as Promise<McpServerTemplate | null>);

  return result;
});

export const listMcpCategoriesServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  try {
    return await withTokenRefresh((api) => api.mcp.listCategories());
  } catch {
    return getPublicBackendApi().mcp.listCategories();
  }
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
        authEnabled?: boolean;
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

  if (!(typeof installationId === "number" || (typeof installationId === "string" && installationId.trim()))) {
    throw new Error("GitHub installation is required");
  }

  const workspaceSlug = payload?.workspace?.trim().toLowerCase();

  return withTokenRefresh(async (api) => {
    let teamId: string | undefined;

    if (workspaceSlug) {
      const teams = await api.workspaces.list();
      const match = teams.items.find((item) => item.slug === workspaceSlug);
      if (match?.id) {
        teamId = match.id;
      }
    }

    const body = {
      git: "github",
      type: "clone",
      clone: {
        name: templateName,
        private: false,
      },
      installationId,
      template,
      serviceType: "mcp",
      authEnabled: payload?.authEnabled !== false,
      ...(teamId ? { teamId } : {}),
    };

    return api.projects.create(body as any);
  });
});
