import { createBackendApi, type BackendApi } from "@/backend";
import config from "@/config";
import {
  getServerAccessToken,
  getServerRefreshToken,
  setServerAuthCookies,
  clearServerAuthCookies,
} from "@/server/auth/cookies";

export function getServerBackendApi() {
  return createBackendApi({
    baseUrl: config.apiUrl,
    getAccessToken: getServerAccessToken,
  });
}

export async function withTokenRefresh<T>(
  fn: (api: BackendApi) => Promise<T>,
): Promise<T> {
  const api = getServerBackendApi();
  try {
    return await fn(api);
  } catch (error: any) {
    if (error?.status !== 401) throw error;

    const refreshToken = getServerRefreshToken();
    if (!refreshToken) throw error;

    try {
      const session = await api.auth.refreshTokens(refreshToken);
      setServerAuthCookies(session);

      const freshApi = createBackendApi({
        baseUrl: config.apiUrl,
        getAccessToken: () => session.accessToken ?? null,
      });
      return await fn(freshApi);
    } catch {
      clearServerAuthCookies();
      throw error;
    }
  }
}
