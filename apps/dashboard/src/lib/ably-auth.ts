import config from "@/config";
import { getAccessTokenServerFn } from "@/server/auth/actions";
import type { AblyAuthOptions } from "@/lib/types/ably";

const getAccessToken = getAccessTokenServerFn as unknown as (input: { data?: undefined }) => Promise<string | null>;

function buildProjectScopedAuthUrl(projectIds: string[]): string {
  const uniqueProjectIds = [...new Set(projectIds.map((value) => value.trim()).filter(Boolean))];
  const url = new URL(`${config.apiUrl}/v1/ably/token`);
  url.searchParams.set("scope", "project");
  if (uniqueProjectIds.length === 1) {
    url.searchParams.set("projectId", uniqueProjectIds[0]);
  } else {
    url.searchParams.set("projectIds", uniqueProjectIds.join(","));
  }
  return url.toString();
}

export async function getProjectScopedAblyOptions(projectIds: string[]): Promise<AblyAuthOptions | null> {
  const scopedIds = [...new Set(projectIds.map((value) => value.trim()).filter(Boolean))];
  if (scopedIds.length === 0) {
    return null;
  }

  const accessToken = await getAccessToken({ data: undefined });
  if (!accessToken) {
    return null;
  }

  return {
    authUrl: buildProjectScopedAuthUrl(scopedIds),
    authHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}
