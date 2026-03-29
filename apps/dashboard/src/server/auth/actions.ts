import { createServerFn } from "@tanstack/react-start";
import { createBackendApi } from "@/backend";
import type {
  AuthSession,
  LoginInput,
  SignupInput,
  UserLookupInput,
  VerifyEmailCodeInput,
} from "@/backend/auth/types";
import config from "@/config";
import {
  clearServerAuthCookies,
  getServerAccessToken,
  getServerRefreshToken,
  setServerAuthCookies,
} from "./cookies";
import {
  getServerBackendApi,
  refreshServerSession,
  withTokenRefresh,
  type ClientGeoData,
} from "@/server/shared/backend";
import { authLogger } from "@/server/shared/logger";

function getErrorMeta(error: any) {
  return {
    status: error?.status ?? null,
    message:
      typeof error?.message === "string"
        ? error.message
        : typeof error?.data?.message === "string"
          ? error.data.message
          : null,
  };
}

export const requestLoginOtpServerFn = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const { geo, ...rest } = data as LoginInput & { geo?: ClientGeoData };
    await getServerBackendApi(geo).auth.login(rest);
    return { ok: true } as const;
  },
);

export const startSignupServerFn = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const { geo, ...rest } = data as SignupInput & { geo?: ClientGeoData };
    await getServerBackendApi(geo).auth.signup(rest);
    return { ok: true } as const;
  },
);

export const lookupAuthServerFn = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const input = data as UserLookupInput;
    return getServerBackendApi().auth.lookup(input);
  },
);

export const resendAuthCodeServerFn = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const { geo, ...rest } = data as LoginInput & { geo?: ClientGeoData };
    await getServerBackendApi(geo).auth.resendCode(rest.email);
    return { ok: true } as const;
  },
);

export const verifyEmailCodeServerFn = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const { geo, ...rest } = data as VerifyEmailCodeInput & { geo?: ClientGeoData };
    const session = await getServerBackendApi(geo).auth.verifyEmailCode(rest);
    setServerAuthCookies(session);

    authLogger.info("verifyEmailCode success", {
      userId: session.user?.id ?? null,
      hasAccessToken: Boolean(session.accessToken),
      hasRefreshToken: Boolean(session.refreshToken),
    });

    return {
      ok: true as const,
      user: session.user,
    };
  },
);

export const logoutServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const refreshToken = getServerRefreshToken();
  authLogger.info("logout start", {
    hasAccessToken: Boolean(getServerAccessToken()),
    hasRefreshToken: Boolean(refreshToken),
  });

  await getServerBackendApi().auth.logout(refreshToken ?? undefined).catch((error: any) => {
    authLogger.warn("logout endpoint failed", getErrorMeta(error));
  });

  clearServerAuthCookies();
  authLogger.info("logout complete");
  return { ok: true } as const;
});

export const requestDeleteAccountOtpServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { turnstileToken?: string } | undefined;
  return withTokenRefresh(async (api) => {
    await api.auth.requestDeleteAccountCode(payload?.turnstileToken);
    return { ok: true } as const;
  });
});

export const confirmDeleteAccountServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { accessCode?: string | number } | undefined;
  const accessCode = String(payload?.accessCode ?? "").trim();

  if (!/^\d{6}$/.test(accessCode)) {
    throw new Error("Enter a valid 6-digit verification code");
  }

  return withTokenRefresh(async (api) => {
    await api.auth.confirmDeleteAccount({ accessCode });
    clearServerAuthCookies();
    authLogger.info("confirmDeleteAccount success");
    return { ok: true } as const;
  });
});

export const getAccessTokenServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return getServerAccessToken();
  },
);

export const getCurrentSessionServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const accessToken = getServerAccessToken();
    if (!accessToken) {
      return null;
    }

    try {
      const session = await getServerBackendApi().auth.getCurrentSession();
      if (!session) return null;
      return { user: session.user };
    } catch (error: any) {
      if (error?.status === 401) return null;
      authLogger.warn("getCurrentSession error", getErrorMeta(error));
      throw error;
    }
  },
);

export const refreshSessionServerFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const refreshToken = getServerRefreshToken();
    if (!refreshToken) {
      authLogger.warn("refreshSession skipped: missing refresh token");
      return null;
    }

    try {
      authLogger.info("refreshSession start", {
        hasAccessToken: Boolean(getServerAccessToken()),
        hasRefreshToken: true,
      });

      const session = await refreshServerSession(refreshToken);
      if (!session) {
        return null;
      }

      authLogger.info("refreshSession success", {
        userId: session.user?.id ?? null,
        hasNewAccessToken: Boolean(session.accessToken),
        hasNewRefreshToken: Boolean(session.refreshToken),
      });

      return { user: session.user };
    } catch (error: any) {
      authLogger.warn("refreshSession failed", getErrorMeta(error));
      return null;
    }
  },
);

export const finalizeOauthSessionServerFn = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const { geo, ...rest } = data as {
      accessToken: string;
      refreshToken?: string;
      user?: Partial<AuthSession["user"]>;
      geo?: ClientGeoData;
    };
    const payload = rest;

    const geoHeaders: Record<string, string> = {};
    if (geo?.ip) geoHeaders["X-Forwarded-For"] = geo.ip;
    if (geo?.city || geo?.region || geo?.country) {
      geoHeaders["X-Client-Location"] = [geo?.city, geo?.region, geo?.country].filter(Boolean).join(", ");
    }
    if (geo?.timezone) geoHeaders["X-Client-Timezone"] = geo.timezone;

    const backendWithOauthToken = createBackendApi({
      baseUrl: config.apiUrl,
      getAccessToken: () => payload.accessToken,
      defaultHeaders: geoHeaders,
    });

    const currentSession = await backendWithOauthToken.auth.getCurrentSession();

    const session: AuthSession = {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user:
        currentSession?.user ?? {
          id: String(payload.user?.id ?? ""),
          email: String(payload.user?.email ?? ""),
          username: payload.user?.username,
          firstName: payload.user?.firstName,
          lastName: payload.user?.lastName,
          company: payload.user?.company,
          name: payload.user?.name,
          onboarded: payload.user?.onboarded,
        },
    };

    setServerAuthCookies(session);

    authLogger.info("finalizeOauthSession success", {
      userId: session.user?.id ?? null,
      hasAccessToken: Boolean(session.accessToken),
      hasRefreshToken: Boolean(session.refreshToken),
    });

    return {
      ok: true as const,
      user: session.user,
    };
  },
);
