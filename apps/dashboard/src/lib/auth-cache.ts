let lastVerifiedAt = 0;
const AUTH_CACHE_TTL_MS = 2 * 60 * 1000;

export function markSessionVerified(): void {
  lastVerifiedAt = Date.now();
}

export function clearSessionCache(): void {
  lastVerifiedAt = 0;
}

export function isSessionRecentlyVerified(): boolean {
  if (lastVerifiedAt === 0) return false;
  return Date.now() - lastVerifiedAt < AUTH_CACHE_TTL_MS;
}

export function hasAccessTokenCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("brimble_access_token=");
}
