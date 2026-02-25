import type { Addon } from "@/components/shared/addon-card";
import type { McpServerTemplate } from "@/backend/mcp";

type VisualTheme = {
  gradient: string;
  logoBg: string;
};

const visualThemes: VisualTheme[] = [
  { gradient: "from-[#53d8ea] to-[#266bf2]", logoBg: "#2b1537" },
  { gradient: "from-[#e94b4b] to-[#e94bbd]", logoBg: "#3a1a5c" },
  { gradient: "from-[#6ab7ff] to-[#594cf3]", logoBg: "#1a3a5c" },
  { gradient: "from-[#4be9df] to-[#dce94b]", logoBg: "#1a3d5c" },
  { gradient: "from-[#ec6492] to-[#e9be4b]", logoBg: "#2b1537" },
  { gradient: "from-[#8653ea] to-[#edbff6]", logoBg: "#3d2c00" },
  { gradient: "from-[#d80eff] via-[#d80eff]/[0.36] to-[#3d3055]", logoBg: "#5c1a1a" },
];

export interface DiscoverAddon extends Addon {
  logoImageUrl?: string;
  mcpId: string;
}

export interface DiscoverAddonDetail {
  id: string;
  mcpId: string;
  name: string;
  description: string;
  longDescription: string;
  developer: string;
  category: string;
  language?: string;
  installsLabel: string;
  website?: string;
  documentationUrl?: string;
  githubUrl?: string;
  verified?: boolean;
  verificationBadge?: string;
  source?: string;
  updatedAtLabel?: string;
  tags: string[];
  features: string[];
  tools: Array<{ name: string; description?: string; requiredCount?: number }>;
  connections: Array<{ type: string; requiredFields: string[] }>;
  gradient: string;
  logoBg: string;
  logo: string;
  logoImageUrl?: string;
  installed?: boolean;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getTheme(seed: string): VisualTheme {
  return visualThemes[hashString(seed) % visualThemes.length];
}

function getFallbackLogoLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

function formatCountLabel(value?: number) {
  if (!value || value <= 0) return "0";
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}K+`;
  }
  return `${value}`;
}

function formatDateLabel(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getMcpTemplateLookupId(template: McpServerTemplate) {
  return template.qualifiedName || template.id;
}

export function encodeDiscoverAddonId(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }

  return btoa(value);
}

export function decodeDiscoverAddonId(value: string): string {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(value, "base64").toString("utf8");
    }
    return atob(value);
  } catch {
    return value;
  }
}

export function mapMcpTemplateToAddon(template: McpServerTemplate): DiscoverAddon {
  const seed = template.qualifiedName || template.id || template.name;
  const theme = getTheme(seed);

  return {
    id: encodeDiscoverAddonId(getMcpTemplateLookupId(template)),
    mcpId: template.id,
    name: template.name,
    description: template.description || "MCP server for AI and workflow integrations.",
    gradient: theme.gradient,
    logo: getFallbackLogoLabel(template.name),
    logoBg: theme.logoBg,
    logoImageUrl: template.iconUrl,
  };
}

export function mapMcpTemplateToAddonDetail(template: McpServerTemplate): DiscoverAddonDetail {
  const addon = mapMcpTemplateToAddon(template);
  const primaryCount = template.useCount ?? template.downloadCount ?? template.stars;

  return {
    id: addon.id,
    mcpId: template.id,
    name: template.name,
    description: template.description || "MCP server for AI and workflow integrations.",
    longDescription:
      template.description ||
      "This MCP server can be deployed on Brimble and connected to your clients and AI workflows.",
    developer: template.author || "Unknown author",
    category: template.category || "MCP Server",
    language: template.language,
    installsLabel: formatCountLabel(primaryCount),
    website: template.homepage || template.externalUrl,
    documentationUrl: template.homepage || template.externalUrl || template.githubUrl,
    githubUrl: template.githubUrl,
    verified: template.verified,
    verificationBadge: template.verificationBadge,
    source: template.source,
    updatedAtLabel: formatDateLabel(template.lastUpdated),
    tags: template.tags,
    features: template.features,
    tools: template.tools.map((tool) => {
      const required = Array.isArray(tool.inputSchema?.required) ? tool.inputSchema.required : [];
      return {
        name: tool.name || "Unnamed tool",
        description: tool.description,
        requiredCount: required.length || undefined,
      };
    }),
    connections: template.connections.map((connection) => {
      const requiredRaw = Array.isArray(connection.configSchema?.required)
        ? connection.configSchema.required
        : [];
      return {
        type: connection.type,
        requiredFields: requiredRaw.filter((item): item is string => typeof item === "string"),
      };
    }),
    gradient: addon.gradient,
    logoBg: addon.logoBg,
    logo: addon.logo,
    logoImageUrl: addon.logoImageUrl,
  };
}
