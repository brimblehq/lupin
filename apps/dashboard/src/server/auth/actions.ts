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
import { getServerBackendApi } from "@/server/shared/backend";

export const requestLoginOtpServerFn = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const input = data as LoginInput;
    await getServerBackendApi().auth.login(input);
    return { ok: true } as const;
  },
);

export const startSignupServerFn = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const input = data as SignupInput;
    await getServerBackendApi().auth.signup(input);
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
    const input = data as LoginInput;
    await getServerBackendApi().auth.resendCode(input.email);
    return { ok: true } as const;
  },
);

export const verifyEmailCodeServerFn = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const input = data as VerifyEmailCodeInput;
    const session = await getServerBackendApi().auth.verifyEmailCode(input);
    setServerAuthCookies(session);

    return {
      ok: true as const,
      user: session.user,
    };
  },
);

export const logoutServerFn = createServerFn({ method: "POST" }).handler(async () => {
  clearServerAuthCookies();
  return { ok: true } as const;
});

export const getAccessTokenServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return getServerAccessToken();
  },
);

export const getCurrentSessionServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getServerBackendApi().auth.getCurrentSession();

    if (!session) {
      return null;
    }

    return {
      user: session.user,
    };
  },
);

export const refreshSessionServerFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const refreshToken = getServerRefreshToken();
    if (!refreshToken) return null;

    try {
      const session = await getServerBackendApi().auth.refreshTokens(refreshToken);
      setServerAuthCookies(session);
      return { user: session.user };
    } catch {
      clearServerAuthCookies();
      return null;
    }
  },
);

export const finalizeOauthSessionServerFn = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const payload = data as {
      accessToken: string;
      refreshToken?: string;
      user?: Partial<AuthSession["user"]>;
    };

    const backendWithOauthToken = createBackendApi({
      baseUrl: config.apiUrl,
      getAccessToken: () => payload.accessToken,
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

    return {
      ok: true as const,
      user: session.user,
    };
  },
);
