import { createBackendApi, type AuthSession, type BackendApi } from "@/backend";
import serverConfig from "@/config/server";
import {
  getServerAccessToken,
  getServerRefreshToken,
  getServerUserAgent,
  getServerClientIp,
  setServerAuthCookies,
  clearServerAuthCookies,
  tokenFingerprint,
} from "@/server/auth/cookies";
import { authLogger } from "@/server/shared/logger";

function getErrorMessage(error: any): string | null {
  if (typeof error?.message === "string") {
    return error.message;
  }

  if (typeof error?.data?.message === "string") {
    return error.data.message;
  }

  return null;
}

function getErrorMeta(error: any) {
  return {
    status: error?.status ?? null,
    message: getErrorMessage(error),
  };
}

function isRefreshTokenReuseError(error: any): boolean {
  const message = getErrorMessage(error) ?? "";
  return /reuse detected/i.test(message);
}

const activeRefreshPromises = new Map<string, Promise<AuthSession>>();
const recentRefreshSessions = new Map<string, { session: AuthSession; expiresAt: number }>();
const RECENT_REFRESH_TTL_MS = 2 * 60 * 1000;

function getRecentRefreshSession(refreshToken: string): AuthSession | null {
  const entry = recentRefreshSessions.get(refreshToken);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    recentRefreshSessions.delete(refreshToken);
    return null;
  }

  return entry.session;
}

function rememberRefreshSession(consumedRefreshToken: string, session: AuthSession) {
  recentRefreshSessions.set(consumedRefreshToken, {
    session,
    expiresAt: Date.now() + RECENT_REFRESH_TTL_MS,
  });
}

function doRefresh(refreshToken: string): Promise<AuthSession> {
  const refreshTokenFp = tokenFingerprint(refreshToken);
  const existingPromise = activeRefreshPromises.get(refreshToken);
  if (existingPromise) {
    authLogger.info("doRefresh: reusing active refresh promise", {
      refreshTokenFp,
    });
    return existingPromise;
  }

  authLogger.info("doRefresh: initiating new refresh", {
    refreshTokenFp,
  });
  const refreshPromise = getServerBackendApi()
    .auth.refreshTokens(refreshToken)
    .then((session) => {
      rememberRefreshSession(refreshToken, session);
      return session;
    })
    .finally(() => {
      if (activeRefreshPromises.get(refreshToken) === refreshPromise) {
        activeRefreshPromises.delete(refreshToken);
      }
    });

  activeRefreshPromises.set(refreshToken, refreshPromise);
  return refreshPromise;
}

function getClientHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const ua = getServerUserAgent();
  if (ua) {
    headers["X-Client-User-Agent"] = ua;
  }
  const ip = getServerClientIp();
  if (ip) {
    headers["X-Forwarded-For"] = ip;
  }
  return headers;
}

export type ClientGeoData = {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
};

export function getServerBackendApi(geo?: ClientGeoData | null) {
  const headers = getClientHeaders();
  if (geo?.ip) {
    headers["X-Forwarded-For"] = geo.ip;
    headers["X-Client-Real-IP"] = geo.ip;
  }
  if (geo?.city || geo?.region || geo?.country) {
    headers["X-Client-Location"] = [geo.city, geo.region, geo.country].filter(Boolean).join(", ");
  }
  if (geo?.timezone) {
    headers["X-Client-Timezone"] = geo.timezone;
  }
  return createBackendApi({
    baseUrl: serverConfig.apiUrl,
    getAccessToken: getServerAccessToken,
    defaultHeaders: headers,
    signatureSecret: serverConfig.hmacSecretKey,
    apiKey: serverConfig.apiKey,
  });
}

export async function refreshServerSession(refreshToken = getServerRefreshToken()): Promise<AuthSession | null> {
  if (!refreshToken) {
    authLogger.warn("refreshSession skipped: missing refresh token");
    return null;
  }

  const refreshTokenFp = tokenFingerprint(refreshToken);
  const currentRefreshToken = getServerRefreshToken();
  const currentRefreshTokenFp = tokenFingerprint(currentRefreshToken);
  const attemptMatchesCurrentRefreshToken = currentRefreshToken === refreshToken;
  const recentSession = getRecentRefreshSession(refreshToken);

  if (recentSession) {
    setServerAuthCookies(recentSession);
    authLogger.info("refreshServerSession using recent refreshed session", {
      refreshTokenFp,
      currentRefreshTokenFp,
      attemptMatchesCurrentRefreshToken,
      nextAccessTokenFp: tokenFingerprint(recentSession.accessToken),
      nextRefreshTokenFp: tokenFingerprint(recentSession.refreshToken),
    });
    return recentSession;
  }

  authLogger.info("refreshServerSession start", {
    refreshTokenFp,
    hasAccessToken: Boolean(getServerAccessToken()),
    currentAccessTokenFp: tokenFingerprint(getServerAccessToken()),
    currentRefreshTokenFp,
    attemptMatchesCurrentRefreshToken,
    reusingActiveRefresh: activeRefreshPromises.has(refreshToken),
  });

  try {
    const session = await doRefresh(refreshToken);
    setServerAuthCookies(session);
    authLogger.info("refreshServerSession success", {
      refreshTokenFp,
      nextAccessTokenFp: tokenFingerprint(session.accessToken),
      nextRefreshTokenFp: tokenFingerprint(session.refreshToken),
    });
    return session;
  } catch (error: any) {
    const status = error?.status;
    const latestRefreshToken = getServerRefreshToken();
    const latestRefreshTokenFp = tokenFingerprint(latestRefreshToken);
    const attemptMatchesLatestRefreshToken = latestRefreshToken === refreshToken;
    const isRefreshReuse = isRefreshTokenReuseError(error);
    const fallbackSession = getRecentRefreshSession(refreshToken);
    if (fallbackSession) {
      setServerAuthCookies(fallbackSession);
      authLogger.warn("refreshServerSession recovered from stale refresh token", {
        refreshTokenFp,
        latestRefreshTokenFp,
        attemptMatchesLatestRefreshToken,
        nextAccessTokenFp: tokenFingerprint(fallbackSession.accessToken),
        nextRefreshTokenFp: tokenFingerprint(fallbackSession.refreshToken),
      });
      return fallbackSession;
    }

    if (isRefreshReuse) {
      authLogger.warn("refreshServerSession refresh-token reuse detected", {
        refreshTokenFp,
        latestRefreshTokenFp,
        attemptMatchesLatestRefreshToken,
        activePromiseForAttempt: activeRefreshPromises.has(refreshToken),
      });
    }

    authLogger.warn("refreshServerSession failed", {
      status: status ?? null,
      message: getErrorMessage(error),
      refreshTokenFp,
      currentAccessTokenFp: tokenFingerprint(getServerAccessToken()),
      currentRefreshTokenFp: latestRefreshTokenFp,
      attemptMatchesLatestRefreshToken,
      isRefreshTokenReuse: isRefreshReuse,
    });

    const isTerminalAuthFailure = status === 401 || status === 403;
    if (isTerminalAuthFailure && attemptMatchesLatestRefreshToken) {
      authLogger.warn("refreshServerSession clearing cookies after terminal refresh failure", {
        status: status ?? null,
        message: getErrorMessage(error),
        refreshTokenFp,
        currentRefreshTokenFp: latestRefreshTokenFp,
      });
      clearServerAuthCookies();
    }

    throw error;
  }
}

const SERIALIZED_HTTP_STATUS_PREFIX = /^\[HTTP (\d{3})\]\s*/;

/**
 * TanStack Start serializes errors across the SSR/client boundary using
 * seroval's ShallowErrorPlugin, which only preserves `message` and `stack`.
 * Custom fields like `status` and `code` on BackendApiError get stripped.
 *
 * Preserve HTTP status in `stack` for downstream checks while keeping
 * `message` clean for user-facing toasts and UI copy.
 */
function makeSerializableError(error: any): any {
  if (!error || typeof error !== "object") {
    return error;
  }

  const rawMessage = typeof error.message === "string" ? error.message : "";
  const statusFromMessage = (() => {
    const match = rawMessage.match(SERIALIZED_HTTP_STATUS_PREFIX);
    if (!match) {
      return undefined;
    }
    return Number(match[1]);
  })();
  const status = typeof error.status === "number" ? error.status : statusFromMessage;

  if (!status) {
    return error;
  }

  const cleanMessage = rawMessage.replace(SERIALIZED_HTTP_STATUS_PREFIX, "");
  if (cleanMessage) {
    error.message = cleanMessage;
  }

  const stackPrefix = `[HTTP ${status}]`;
  if (typeof error.stack === "string") {
    if (!error.stack.startsWith(stackPrefix)) {
      error.stack = `${stackPrefix}\n${error.stack}`;
    }
  } else {
    error.stack = stackPrefix;
  }

  return error;
}

export async function withTokenRefresh<T>(fn: (api: BackendApi) => Promise<T>): Promise<T> {
  try {
    return await withTokenRefreshImpl(fn);
  } catch (error: any) {
    throw makeSerializableError(error);
  }
}

async function withTokenRefreshImpl<T>(fn: (api: BackendApi) => Promise<T>): Promise<T> {
  const accessToken = getServerAccessToken();
  const refreshToken = getServerRefreshToken();

  if (refreshToken) {
    const recentSession = getRecentRefreshSession(refreshToken);
    if (recentSession?.accessToken) {
      setServerAuthCookies(recentSession);
      authLogger.info("withTokenRefresh using recent session before request", {
        refreshTokenFp: tokenFingerprint(refreshToken),
        nextAccessTokenFp: tokenFingerprint(recentSession.accessToken),
        nextRefreshTokenFp: tokenFingerprint(recentSession.refreshToken),
      });

      const recentApi = createBackendApi({
        baseUrl: serverConfig.apiUrl,
        getAccessToken: () => recentSession.accessToken ?? null,
        defaultHeaders: getClientHeaders(),
        signatureSecret: serverConfig.hmacSecretKey,
        apiKey: serverConfig.apiKey,
      });

      try {
        return await fn(recentApi);
      } catch (error: any) {
        if (error?.status !== 401) {
          throw error;
        }

        authLogger.warn("withTokenRefresh recent session request returned 401", {
          hasRefreshToken: true,
          ...getErrorMeta(error),
        });
      }
    }
  }

  if (!accessToken && refreshToken) {
    authLogger.info("withTokenRefresh bootstrap refresh start", {
      hasAccessToken: false,
      hasRefreshToken: true,
    });

    try {
      const session = await refreshServerSession(refreshToken);
      if (!session) {
        throw new Error("Refresh token missing");
      }

      authLogger.info("withTokenRefresh bootstrap refresh success", {
        hasNewAccessToken: Boolean(session.accessToken),
        hasNewRefreshToken: Boolean(session.refreshToken),
        userId: session.user?.id ?? null,
      });

      const freshApi = createBackendApi({
        baseUrl: serverConfig.apiUrl,
        getAccessToken: () => session.accessToken ?? null,
        defaultHeaders: getClientHeaders(),
        signatureSecret: serverConfig.hmacSecretKey,
        apiKey: serverConfig.apiKey,
      });

      return await fn(freshApi);
    } catch (error: any) {
      authLogger.warn("withTokenRefresh bootstrap refresh failed", {
        ...getErrorMeta(error),
        hasRefreshToken: true,
      });
      throw error;
    }
  }

  const api = getServerBackendApi();
  try {
    return await fn(api);
  } catch (error: any) {
    if (error?.status !== 401) {
      throw error;
    }

    authLogger.warn("withTokenRefresh request returned 401", {
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(getServerRefreshToken()),
      ...getErrorMeta(error),
    });

    const refreshToken = getServerRefreshToken();
    if (!refreshToken) {
      authLogger.warn("withTokenRefresh cannot retry after 401: missing refresh token", {
        currentAccessTokenFp: tokenFingerprint(getServerAccessToken()),
        currentRefreshTokenFp: tokenFingerprint(getServerRefreshToken()),
      });
      throw error;
    }

    try {
      authLogger.info("withTokenRefresh retry refresh start", {
        hasRefreshToken: true,
      });

      const session = await refreshServerSession(refreshToken);
      if (!session) {
        throw new Error("Refresh token missing");
      }

      authLogger.info("withTokenRefresh retry refresh success", {
        hasNewAccessToken: Boolean(session.accessToken),
        hasNewRefreshToken: Boolean(session.refreshToken),
        userId: session.user?.id ?? null,
      });

      const freshApi = createBackendApi({
        baseUrl: serverConfig.apiUrl,
        getAccessToken: () => session.accessToken ?? null,
        defaultHeaders: getClientHeaders(),
        signatureSecret: serverConfig.hmacSecretKey,
        apiKey: serverConfig.apiKey,
      });
      return await fn(freshApi);
    } catch (refreshError: any) {
      authLogger.warn("withTokenRefresh retry refresh failed", {
        ...getErrorMeta(refreshError),
        hasRefreshToken: true,
      });
      throw refreshError;
    }
  }
}
