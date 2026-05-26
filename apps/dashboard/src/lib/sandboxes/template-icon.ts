export interface TemplateIcon {
  /** Public path to the icon asset. */
  src: string;
  /** Monochrome (black) icons set this so callers invert them to white in dark mode. */
  shouldInvert: boolean;
}

/**
 * Maps a sandbox template name to its icon. Returns null when no known mapping
 * exists so callers can render their own fallback (typically the first letter
 * of the sandbox name).
 */
export function getTemplateIcon(template: string): TemplateIcon | null {
  const t = template.toLowerCase();
  if (t.includes("python")) return { src: "/icons/python.svg", shouldInvert: false };
  if (t.includes("node")) return { src: "/icons/nodejs.svg", shouldInvert: false };
  if (t.includes("ubuntu")) return { src: "/icons/ubuntu.svg", shouldInvert: false };
  if (t.includes("bun")) return { src: "/icons/bun.svg", shouldInvert: false };
  if (t.includes("opencode")) return { src: "/icons/opencode.svg", shouldInvert: false };
  if (t.includes("claude")) return { src: "/icons/claude.svg", shouldInvert: false };
  if (t.includes("codex")) return { src: "/icons/codex.svg", shouldInvert: true };
  if (t.includes("deno")) return { src: "/icons/deno.svg", shouldInvert: true };
  return null;
}
