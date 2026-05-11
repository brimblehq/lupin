let lastVerifiedAt = 0;
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
const isBrowser = typeof window !== "undefined";

export function markSessionVerified(): void {
  if (!isBrowser) {
    return;
  }

  lastVerifiedAt = Date.now();
}

export function clearSessionCache(): void {
  if (!isBrowser) {
    return;
  }

  lastVerifiedAt = 0;
}

export function isSessionRecentlyVerified(): boolean {
  if (!isBrowser) {
    return false;
  }

  if (lastVerifiedAt === 0) return false;
  return Date.now() - lastVerifiedAt < AUTH_CACHE_TTL_MS;
}
