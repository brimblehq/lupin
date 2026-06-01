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
  const patterns = ["reuse detected", "refresh token already used", "retry with current session"];
  const message = (getErrorMessage(error) ?? "").toLowerCase();
  return patterns.some((pattern) => message.includes(pattern));
}

function isRefreshRotationInProgressError(error: any): boolean {
  const message = (getErrorMessage(error) ?? "").toLowerCase();

  return message.includes("refresh already in progress");
}

const activeRefreshPromises = new Map<string, Promise<AuthSession>>();
const recentRefreshSessions = new Map<string, { session: AuthSession; expiresAt: number }>();
const RECENT_REFRESH_TTL_MS = 2 * 60 * 1000;

type WorkspaceListResult = Awaited<ReturnType<BackendApi["workspaces"]["list"]>>;

const workspacesCache = new Map<string, { promise: Promise<WorkspaceListResult>; expiresAt: number }>();

const WORKSPACES_CACHE_TTL_MS = 5_000;

async function getCachedWorkspaces(api: BackendApi): Promise<WorkspaceListResult> {
  const accessToken = getServerAccessToken();

  if (!accessToken) {
    return api.workspaces.list();
  }

  const key = tokenFingerprint(accessToken);
  if (!key) {
    return api.workspaces.list();
  }

  const existing = workspacesCache.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.promise;
  }

  const promise = api.workspaces.list();
  workspacesCache.set(key, { promise, expiresAt: Date.now() + WORKSPACES_CACHE_TTL_MS });
  promise.catch(() => {
    if (workspacesCache.get(key)?.promise === promise) {
      workspacesCache.delete(key);
    }
  });
  return promise;
}

type WorkspaceItem = WorkspaceListResult["items"][number];

export async function resolveWorkspace(api: BackendApi, slug: string | undefined | null): Promise<WorkspaceItem | undefined> {
  if (!slug) return undefined;
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return undefined;
  const teams = await getCachedWorkspaces(api);
  return teams.items.find((item) => item.slug?.toLowerCase() === normalized);
}

export async function resolveTeamId(api: BackendApi, slug: string | undefined | null): Promise<string | undefined> {
  const match = await resolveWorkspace(api, slug);
  return match?.id ?? undefined;
}

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

function createUnauthorizedError(message: string) {
  const error = new Error(message) as Error & { status?: number; code?: string };
  error.status = 401;
  error.code = "UNAUTHORIZED";
  return error;
}

export function isRefreshTokenReuseStatus(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const status = "status" in error ? error.status : undefined;
  if (status !== 409) {
    return false;
  }

  return isRefreshTokenReuseError(error);
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

function getClientHeaders(opts?: { stepUpToken?: string }): Record<string, string> {
  const headers: Record<string, string> = {};
  const ua = getServerUserAgent();
  if (ua) {
    headers["X-Client-User-Agent"] = ua;
  }
  const ip = getServerClientIp();
  if (ip) {
    headers["X-Forwarded-For"] = ip;
  }
  const stepUpToken = opts?.stepUpToken?.trim();
  if (stepUpToken) {
    headers["X-2FA-Token"] = stepUpToken;
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
    const isRefreshInProgress = isRefreshRotationInProgressError(error);
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
      isRefreshInProgress,
    });

    const isTerminalAuthFailure = status === 401 || status === 403;
    const shouldClearCookies = isTerminalAuthFailure && attemptMatchesLatestRefreshToken && !isRefreshReuse && !isRefreshInProgress;

    if (shouldClearCookies) {
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
 * Pull the step-up challenge fields out of a backend 403 response.
 * Backend shape: `{ message, data: { requires_2fa: true, action, resource_id } }`.
 */
function extractStepUpRequirement(payload: unknown): { action: string; resourceId: string } | null {
  const data = (payload as any)?.data;
  if (!data?.requires_2fa) return null;

  const action = String(data.action ?? "").trim();
  const resourceId = String(data.resource_id ?? "").trim();
  if (!action || !resourceId) return null;

  return { action, resourceId };
}

function makeSerializableError(error: any): any {
  if (!error || typeof error !== "object") {
    return error;
  }

  const rawMessage = typeof error.message === "string" ? error.message : "";
  const statusFromMessage = (() => {
    const match = rawMessage.match(SERIALIZED_HTTP_STATUS_PREFIX);
    return match ? Number(match[1]) : undefined;
  })();
  const status = typeof error.status === "number" ? error.status : statusFromMessage;

  if (!status) {
    return error;
  }

  let nextMessage = rawMessage.replace(SERIALIZED_HTTP_STATUS_PREFIX, "");

  if (status === 403) {
    const stepUp = extractStepUpRequirement(error.details);
    if (stepUp) {
      nextMessage = `[STEP_UP|${stepUp.action}|${stepUp.resourceId}] ${nextMessage}`;
    }
  }

  if (nextMessage) {
    error.message = nextMessage;
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

export interface WithTokenRefreshOptions {
  /** Optional step-up 2FA token. When set, attached as `X-2FA-Token` header. */
  stepUpToken?: string;
}

export async function withTokenRefresh<T>(fn: (api: BackendApi) => Promise<T>, options?: WithTokenRefreshOptions): Promise<T> {
  try {
    return await withTokenRefreshImpl(fn, options);
  } catch (error: any) {
    throw makeSerializableError(error);
  }
}

async function withTokenRefreshImpl<T>(fn: (api: BackendApi) => Promise<T>, options?: WithTokenRefreshOptions): Promise<T> {
  const stepUpToken = options?.stepUpToken;
  const accessToken = getServerAccessToken();
  const refreshToken = getServerRefreshToken();

  if (!accessToken && !refreshToken) {
    throw createUnauthorizedError("Unauthorized");
  }

  if (refreshToken) {
    const recentSession = getRecentRefreshSession(refreshToken);
    if (recentSession?.accessToken) {
      setServerAuthCookies(recentSession);
      authLogger.debug("withTokenRefresh using recent session before request", {
        refreshTokenFp: tokenFingerprint(refreshToken),
        nextAccessTokenFp: tokenFingerprint(recentSession.accessToken),
        nextRefreshTokenFp: tokenFingerprint(recentSession.refreshToken),
      });

      const recentApi = createBackendApi({
        baseUrl: serverConfig.apiUrl,
        getAccessToken: () => recentSession.accessToken ?? null,
        defaultHeaders: getClientHeaders({ stepUpToken }),
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
        defaultHeaders: getClientHeaders({ stepUpToken }),
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

  const api = stepUpToken
    ? createBackendApi({
        baseUrl: serverConfig.apiUrl,
        getAccessToken: getServerAccessToken,
        defaultHeaders: getClientHeaders({ stepUpToken }),
        signatureSecret: serverConfig.hmacSecretKey,
        apiKey: serverConfig.apiKey,
      })
    : getServerBackendApi();
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
        defaultHeaders: getClientHeaders({ stepUpToken }),
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
