export type ProjectDeploySourceType = "github" | "bitbucket" | "docker" | "database";

export function getLegacyServiceType(
  sourceType: ProjectDeploySourceType,
  frameworkId: string,
) {
  if (sourceType === "docker") return "web-service";
  const normalized = frameworkId.trim().toLowerCase();
  if (normalized === "static" || normalized === "html") return "static";
  return "web-service";
}

/**
 * Frameworks that need no build step (plain HTML, pre-built static assets).
 * Build/install/start commands should be hidden for these.
 */
export function isNoBuildFramework(frameworkId: string): boolean {
  const normalized = frameworkId.trim().toLowerCase();
  return normalized === "html" || normalized === "static";
}

export function getEnvPrefixForFramework(frameworkId: string) {
  const normalized = frameworkId.trim().toLowerCase();
  if (
    normalized.includes("node") ||
    normalized.includes("next") ||
    normalized.includes("vite") ||
    normalized.includes("remix") ||
    normalized.includes("astro")
  ) {
    return "NODE_";
  }
  if (normalized.includes("python")) return "PYTHON_";
  if (normalized.includes("go")) return "GO_";
  if (normalized.includes("php")) return "PHP_";
  if (normalized.includes("ruby")) return "RUBY_";
  return "";
}
