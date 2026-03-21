import type { ApiClient } from "./types";
import {
  asRecord,
  asString,
  pickBoolean,
  pickNonEmptyString,
  pickNumber,
  pickString,
} from "./normalize";

export interface McpConnection {
  type: string;
  url?: string;
  deploymentUrl?: string;
  exampleConfig?: Record<string, unknown>;
  configSchema?: Record<string, unknown>;
}

export interface McpTool {
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpServerTemplate {
  id: string;
  name: string;
  description?: string;
  author?: string;
  category?: string;
  language?: string;
  githubUrl?: string;
  homepage?: string;
  externalUrl?: string;
  iconUrl?: string;
  qualifiedName?: string;
  verified?: boolean;
  verificationBadge?: string;
  source?: string;
  useCount?: number;
  downloadCount?: number;
  stars?: number;
  isDeployed?: boolean;
  lastUpdated?: string;
  tags: string[];
  features: string[];
  tools: McpTool[];
  connections: McpConnection[];
}

export interface McpServerListResult {
  servers: McpServerTemplate[];
  pagination: {
    total?: number;
    limit?: number;
    offset?: number;
    cursor?: number;
    hasMore?: boolean;
  };
  provider?: string;
}

export interface McpApi {
  listTemplates(input?: {
    query?: string;
    limit?: number;
    offset?: number;
    cursor?: string;
    category?: string;
    verified?: boolean;
  }): Promise<McpServerListResult>;
  listRecommendedTemplates(input?: {
    limit?: number;
    category?: string;
    officialOnly?: boolean;
    shuffle?: boolean;
    provider?: "smithery" | "pulsemcp" | "auto";
  }): Promise<McpServerListResult>;
  getTemplate(id: string): Promise<McpServerTemplate | null>;
  listCategories(): Promise<string[]>;
}

function mapStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)?.trim() ?? "").filter(Boolean);
}

function mapMcpConnection(value: unknown): McpConnection | null {
  const row = asRecord(value);
  if (!row) return null;

  const type = pickNonEmptyString(row, "type");
  if (!type) return null;

  return {
    type,
    url: pickNonEmptyString(row, "url"),
    deploymentUrl: pickNonEmptyString(row, "deploymentUrl", "deployment_url"),
    exampleConfig: asRecord(row.exampleConfig) ?? asRecord(row.example_config),
    configSchema: asRecord(row.configSchema) ?? asRecord(row.config_schema),
  };
}

function mapMcpTool(value: unknown): McpTool | null {
  const row = asRecord(value);
  if (!row) return null;

  const name = pickString(row, "name");
  const description = pickString(row, "description");
  const inputSchema = asRecord(row.inputSchema) ?? asRecord(row.input_schema);

  if (!name && !description) return null;

  return {
    name,
    description,
    inputSchema,
  };
}

function mapMcpServerTemplate(value: unknown): McpServerTemplate | null {
  const row = asRecord(value);
  if (!row) return null;

  const id = pickNonEmptyString(row, "id", "_id");
  const name = pickNonEmptyString(row, "name");
  if (!id || !name) return null;

  const rawTools = Array.isArray(row.tools) ? row.tools : [];
  const rawConnections = Array.isArray(row.connections) ? row.connections : [];

  return {
    id,
    name,
    description: pickString(row, "description"),
    author: pickString(row, "author"),
    category: pickString(row, "category"),
    language: pickString(row, "language"),
    githubUrl: pickString(row, "githubUrl", "github_url"),
    homepage: pickString(row, "homepage"),
    externalUrl: pickString(row, "externalUrl", "external_url"),
    iconUrl: pickString(row, "iconUrl", "icon_url"),
    qualifiedName: pickString(row, "qualifiedName", "qualified_name"),
    verified: pickBoolean(row, "verified"),
    verificationBadge: pickString(row, "verificationBadge", "verification_badge"),
    source: pickString(row, "source"),
    useCount: pickNumber(row, "useCount", "use_count"),
    downloadCount: pickNumber(row, "downloadCount", "download_count"),
    stars: pickNumber(row, "stars"),
    isDeployed: pickBoolean(row, "isDeployed", "is_deployed"),
    lastUpdated: pickString(row, "lastUpdated", "last_updated", "updatedAt", "updated_at"),
    tags: mapStringArray(row.tags),
    features: mapStringArray(row.features),
    tools: rawTools.map(mapMcpTool).filter((item): item is McpTool => item !== null),
    connections: rawConnections
      .map(mapMcpConnection)
      .filter((item): item is McpConnection => item !== null),
  };
}

export function createMcpApi(client: ApiClient): McpApi {
  return {
    async listTemplates(input) {
      const response = await client.request<any>("/core/v1/templates/mcp-servers", {
        method: "GET",
        query: {
          query: input?.query,
          limit: input?.limit,
          offset: input?.offset,
          cursor: input?.cursor,
          category: input?.category,
          verified: input?.verified,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawServers = Array.isArray(root?.servers)
        ? root.servers
        : Array.isArray(root)
          ? root
          : [];
      const paginationRow = asRecord(root?.pagination);

      return {
        servers: rawServers
          .map((item: unknown) => mapMcpServerTemplate(item))
          .filter((item: McpServerTemplate | null): item is McpServerTemplate => item !== null),
        pagination: {
          total: pickNumber(paginationRow, "total"),
          limit: pickNumber(paginationRow, "limit"),
          offset: pickNumber(paginationRow, "offset"),
          cursor: pickNumber(paginationRow, "cursor"),
          hasMore: pickBoolean(paginationRow, "hasMore", "has_more"),
        },
        provider: pickString(asRecord(root), "provider"),
      } satisfies McpServerListResult;
    },

    async listRecommendedTemplates(input) {
      const response = await client.request<any>("/core/v1/templates/mcp-servers/recommended", {
        method: "GET",
        query: {
          limit: input?.limit,
          category: input?.category,
          officialOnly: input?.officialOnly,
          shuffle: input?.shuffle,
          provider: input?.provider,
        },
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const rawServers = Array.isArray(root?.servers)
        ? root.servers
        : Array.isArray(root)
          ? root
          : [];
      const paginationRow = asRecord(root?.pagination);

      return {
        servers: rawServers
          .map((item: unknown) => mapMcpServerTemplate(item))
          .filter((item: McpServerTemplate | null): item is McpServerTemplate => item !== null),
        pagination: {
          total: pickNumber(paginationRow, "total"),
          limit: pickNumber(paginationRow, "limit"),
          offset: pickNumber(paginationRow, "offset"),
          cursor: pickNumber(paginationRow, "cursor"),
          hasMore: pickBoolean(paginationRow, "hasMore", "has_more"),
        },
        provider: pickString(asRecord(root), "provider"),
      } satisfies McpServerListResult;
    },

    async getTemplate(id) {
      const response = await client.request<any>(`/core/v1/templates/mcp-servers/${id}`, {
        method: "GET",
      });

      const root = response?.data?.data ?? response?.data ?? response ?? null;
      return mapMcpServerTemplate(root);
    },

    async listCategories() {
      const response = await client.request<any>("/core/v1/templates/mcp-servers/categories", {
        method: "GET",
      });

      const root = response?.data?.data ?? response?.data ?? response ?? {};
      const categories = root?.categories;
      return Array.isArray(categories) ? categories.filter((c: unknown) => typeof c === "string") : [];
    },
  };
}
