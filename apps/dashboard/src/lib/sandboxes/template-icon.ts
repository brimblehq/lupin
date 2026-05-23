/**
 * Maps a sandbox template name to a public icon path. Returns null when no
 * known mapping exists so callers can render their own fallback (typically
 * the first letter of the sandbox name).
 */
export function getTemplateIcon(template: string): string | null {
  const t = template.toLowerCase();
  if (t.includes("python")) return "/icons/python.svg";
  if (t.includes("node")) return "/icons/nodejs.svg";
  if (t.includes("ubuntu")) return "/icons/ubuntu.svg";
  if (t.includes("bun")) return "/icons/bun.svg";
  if (t.includes("opencode")) return "/icons/opencode.svg";
  if (t.includes("claude")) return "/icons/claude.svg";
  if (t.includes("deno")) return "/icons/deno.svg";
  return null;
}
