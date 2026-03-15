import { useEffect, useState, type ComponentProps } from "react";

interface AvatarProps extends Omit<ComponentProps<"img">, "onError"> {
  fallbackSeed?: string;
}

function escapeXml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getInitials(seed: string) {
  const value = seed.trim();
  if (!value) {
    return "U";
  }

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase() || "U";
}

function hashHue(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }

  return Math.abs(hash) % 360;
}

function getFallbackUrl(seed: string) {
  const initials = escapeXml(getInitials(seed));
  const hue = hashHue(seed);
  const hue2 = (hue + 24) % 360;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="avatarGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue}, 70%, 56%)"/>
          <stop offset="100%" stop-color="hsl(${hue2}, 68%, 44%)"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill="url(#avatarGradient)"/>
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        fill="#ffffff"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="24"
        font-weight="600"
      >${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function Avatar({ src, fallbackSeed = "user", alt = "", ...props }: AvatarProps) {
  const fallback = getFallbackUrl(fallbackSeed);
  const [imgSrc, setImgSrc] = useState(src || fallback);

  useEffect(() => {
    setImgSrc(src || fallback);
  }, [src, fallback]);

  return (
    <img
      {...props}
      src={imgSrc}
      alt={alt}
      onError={() => {
        if (imgSrc !== fallback) {
          setImgSrc(fallback);
        }
      }}
    />
  );
}
