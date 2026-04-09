import { getClientGeoServerFn } from "@/server/shared/client-geo";

export type ClientGeoInfo = {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
};

let cached: ClientGeoInfo | null = null;
let pending: Promise<ClientGeoInfo | null> | null = null;

export function getClientGeo(): Promise<ClientGeoInfo | null> {
  if (cached) return Promise.resolve(cached);
  if (typeof window === "undefined") return Promise.resolve(null);

  if (!pending) {
    pending = getClientGeoServerFn()
      .then((data) => {
        if (!data) return null;
        cached = data;
        return cached;
      })
      .catch(() => null);
  }

  return pending;
}

export function getCachedClientGeo() {
  return cached;
}
