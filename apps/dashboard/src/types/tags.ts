export interface Tag {
  id: string;
  name: string; // lowercase, trimmed, max 30 chars
  color: string; // any hex color
}

export const TAG_PRESET_COLORS = [
  "#4879f8",
  "#34d399",
  "#f5a623",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
] as const;

export const MAX_TAG_NAME_LENGTH = 30;

export function randomTagColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return hslToHex(hue, 70, 55);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function normalizeTagName(raw: string): string {
  return raw.trim().toLowerCase().slice(0, MAX_TAG_NAME_LENGTH);
}

