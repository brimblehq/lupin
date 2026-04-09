import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

export type ClientGeoPayload = {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
};

export const getClientGeoServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ClientGeoPayload | null> => {
    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      "";

    if (!ip) return null;

    return {
      ip,
      city: decodeHeader(getRequestHeader("cf-ipcity")),
      region: decodeHeader(getRequestHeader("cf-region")),
      country: getRequestHeader("cf-ipcountry") ?? undefined,
      timezone: getRequestHeader("cf-timezone") ?? undefined,
    };
  },
);

function decodeHeader(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
