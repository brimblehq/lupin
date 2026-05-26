import { createServerFn } from "@tanstack/react-start";
import * as Yup from "yup";
import { createBackendApi } from "@/backend";
import type {
  AuthSession,
  LoginInput,
  PasskeyFeatureStatus,
  SignupInput,
  TwoFactorCodeInput,
  UserLookupInput,
  VerifyEmailCodeInput,
  VerifyTwoFactorChallengeInput,
} from "@/backend/auth/types";
import serverConfig from "@/config/server";
import { clearServerAuthCookies, getServerAccessToken, getServerRefreshToken, setServerAuthCookies } from "./cookies";
import { getServerBackendApi, refreshServerSession, withTokenRefresh, type ClientGeoData } from "@/server/shared/backend";
import { authLogger } from "@/server/shared/logger";

function getErrorMeta(error: any) {
  return {
    status: error?.status ?? null,
    message: typeof error?.message === "string" ? error.message : typeof error?.data?.message === "string" ? error.data.message : null,
  };
}

export const requestLoginOtpServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as (LoginInput & { geo?: ClientGeoData }) | undefined;
  if (!payload?.email) {
    throw new Error("Email is required");
  }
  const { geo, ...rest } = payload;
  await getServerBackendApi(geo).auth.login(rest);
  return { ok: true } as const;
});

export const startSignupServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as (SignupInput & { geo?: ClientGeoData }) | undefined;
  if (!payload?.email || !payload?.username) {
    throw new Error("Email and username are required");
  }
  const { geo, ...rest } = payload;
  await getServerBackendApi(geo).auth.signup(rest);
  return { ok: true } as const;
});

export const lookupAuthServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const input = data as UserLookupInput;
  return getServerBackendApi().auth.lookup(input);
});

export const checkUsernameAvailabilityServerFn = createServerFn({ method: "GET" }).handler(async ({ data }) => {
  const payload = data as { username?: string } | undefined;
  const username = payload?.username?.trim();
  if (!username) {
    throw new Error("Username is required");
  }
  return getServerBackendApi().auth.checkUsername(username);
});

export const resendAuthCodeServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as (LoginInput & { geo?: ClientGeoData }) | undefined;
  if (!payload?.email) {
    throw new Error("Email is required");
  }
  const { geo, ...rest } = payload;
  await getServerBackendApi(geo).auth.resendCode(rest.email);
  return { ok: true } as const;
});

export const verifyEmailCodeServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const { geo, ...rest } = data as VerifyEmailCodeInput & { geo?: ClientGeoData };
  const result = await getServerBackendApi(geo).auth.verifyEmailCode(rest);

  if (result.requiresTwoFactor) {
    return {
      ok: true as const,
      requiresTwoFactor: true as const,
      challengeToken: result.challengeToken,
      expiresIn: result.expiresIn,
    };
  }

  const session = result.session;
  setServerAuthCookies(session);

  authLogger.info("verifyEmailCode success", {
    userId: session.user?.id ?? null,
    hasAccessToken: Boolean(session.accessToken),
    hasRefreshToken: Boolean(session.refreshToken),
  });

  return {
    ok: true as const,
    requiresTwoFactor: false as const,
    user: session.user,
  };
});

export const verifyTwoFactorChallengeServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as VerifyTwoFactorChallengeInput & { geo?: ClientGeoData };
  const challengeToken = payload.challengeToken?.trim();
  const code = String(payload.code ?? "").trim();

  if (!challengeToken) {
    throw new Error("Missing challenge token. Please log in again.");
  }

  if (!code) {
    throw new Error("Enter a verification code.");
  }

  const session = await getServerBackendApi(payload.geo).auth.verifyTwoFactorChallenge({
    challengeToken,
    code,
  });
  setServerAuthCookies(session);

  authLogger.info("verifyTwoFactorChallenge success", {
    userId: session.user?.id ?? null,
    hasAccessToken: Boolean(session.accessToken),
    hasRefreshToken: Boolean(session.refreshToken),
  });

  return {
    ok: true as const,
    user: session.user,
  };
});

export const getTwoFactorStatusServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return withTokenRefresh((api) => api.auth.getTwoFactorStatus());
});

export const startTwoFactorSetupServerFn = createServerFn({ method: "POST" }).handler(async () => {
  return withTokenRefresh((api) => api.auth.startTwoFactorSetup());
});

export const verifyTwoFactorSetupServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as TwoFactorCodeInput | undefined;
  const code = String(payload?.code ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    throw new Error("Enter a valid 6-digit code");
  }

  return withTokenRefresh(async (api) => {
    await api.auth.verifyTwoFactorSetup({ code });
    return { ok: true } as const;
  });
});

export const disableTwoFactorServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as TwoFactorCodeInput | undefined;
  const code = String(payload?.code ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    throw new Error("Enter a valid 6-digit code");
  }

  return withTokenRefresh(async (api) => {
    await api.auth.disableTwoFactor({ code });
    return { ok: true } as const;
  });
});

export const regenerateTwoFactorRecoveryCodesServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as TwoFactorCodeInput | undefined;
  const code = String(payload?.code ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    throw new Error("Enter a valid 6-digit code");
  }

  return withTokenRefresh(async (api) => {
    const recoveryCodes = await api.auth.regenerateTwoFactorRecoveryCodes({
      code,
    });
    return { recoveryCodes } as const;
  });
});

// 6-digit TOTP or 8-character recovery code, per the auth-service /2fa/step-up contract.
const stepUpTwoFactorSchema = Yup.object({
  code: Yup.string()
    .trim()
    .required("Enter a 6-digit code or 8-character recovery code")
    .matches(/^(\d{6}|[A-Za-z0-9]{8})$/, "Enter a 6-digit code or 8-character recovery code"),
  action: Yup.string().trim().required("Step-up action is required"),
  resourceId: Yup.string().trim().required("Step-up resource is required"),
});

export const stepUpTwoFactorServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const { code, action, resourceId } = stepUpTwoFactorSchema.validateSync(data, { stripUnknown: true });
  return withTokenRefresh((api) => api.auth.stepUpTwoFactor({ code, action, resourceId }));
});

export const logoutServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const refreshToken = getServerRefreshToken();
  clearServerAuthCookies();

  void getServerBackendApi()
    .auth.logout(refreshToken ?? undefined)
    .catch((error: any) => {
      authLogger.warn("logout endpoint failed", getErrorMeta(error));
    });

  authLogger.info("logout cookies cleared", {
    hadRefreshToken: Boolean(refreshToken),
  });
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

export const getAccessTokenServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return getServerAccessToken();
});

export const getCurrentSessionServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const accessToken = getServerAccessToken();
  if (!accessToken) {
    authLogger.info("getCurrentSession skipped: missing access token");
    return null;
  }

  try {
    const session = await getServerBackendApi().auth.getCurrentSession();
    if (!session) {
      authLogger.warn("getCurrentSession returned empty session");
      return null;
    }
    return { user: session.user };
  } catch (error: any) {
    if (error?.status === 401) {
      authLogger.info("getCurrentSession unauthorized (401)");
      return null;
    }
    authLogger.warn("getCurrentSession error", getErrorMeta(error));
    throw error;
  }
});

type RefreshSessionServerResult =
  | {
      status: "ok";
      user: AuthSession["user"];
    }
  | {
      status: "missing";
    }
  | {
      status: "expired";
    }
  | {
      status: "error";
    };

export const refreshSessionServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const refreshToken = getServerRefreshToken();
  if (!refreshToken) {
    authLogger.info("refreshSession skipped: missing refresh token");
    return {
      status: "missing",
    } satisfies RefreshSessionServerResult;
  }

  try {
    authLogger.info("refreshSession start", {
      hasAccessToken: Boolean(getServerAccessToken()),
      hasRefreshToken: true,
    });

    const session = await refreshServerSession(refreshToken);
    if (!session) {
      authLogger.warn("refreshSession returned empty session");
      return {
        status: "missing",
      } satisfies RefreshSessionServerResult;
    }

    authLogger.info("refreshSession success", {
      userId: session.user?.id ?? null,
      hasNewAccessToken: Boolean(session.accessToken),
      hasNewRefreshToken: Boolean(session.refreshToken),
    });

    return {
      status: "ok",
      user: session.user,
    } satisfies RefreshSessionServerResult;
  } catch (error: any) {
    const status = error?.status;
    authLogger.warn("refreshSession failed", getErrorMeta(error));

    if (status === 401 || status === 403) {
      authLogger.warn("refreshSession expired", {
        status,
      });
      return {
        status: "expired",
      } satisfies RefreshSessionServerResult;
    }

    return {
      status: "error",
    } satisfies RefreshSessionServerResult;
  }
});

export const finalizeOauthSessionServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
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
    baseUrl: serverConfig.apiUrl,
    getAccessToken: () => payload.accessToken,
    defaultHeaders: geoHeaders,
    signatureSecret: serverConfig.hmacSecretKey,
    apiKey: serverConfig.apiKey,
  });

  const currentSession = await backendWithOauthToken.auth.getCurrentSession();

  const session: AuthSession = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: currentSession?.user ?? {
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
});

function createRecoveryBackend(recoveryToken: string) {
  return createBackendApi({
    baseUrl: serverConfig.apiUrl,
    getAccessToken: () => recoveryToken,
    signatureSecret: serverConfig.hmacSecretKey,
    apiKey: serverConfig.apiKey,
  });
}

export const getPasskeyFeatureStatusServerFn = createServerFn({ method: "GET" }).handler(async (): Promise<PasskeyFeatureStatus> => {
  try {
    return await getServerBackendApi().auth.getPasskeyFeatureStatus();
  } catch (error: any) {
    authLogger.warn("getPasskeyFeatureStatus failed", getErrorMeta(error));
    return { enabled: false };
  }
});

export const getPasskeyRegisterOptionsServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as { deviceName?: string } | undefined;
  const deviceName = String(payload?.deviceName ?? "").trim();
  if (!deviceName) {
    throw new Error("Enter a name for this device.");
  }
  return withTokenRefresh((api) => api.auth.passkeyRegisterOptions({ deviceName }));
});

export const verifyPasskeyRegistrationServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as { challengeToken?: string; credential?: unknown; deviceName?: string } | undefined;
  const challengeToken = String(payload?.challengeToken ?? "").trim();
  const deviceName = String(payload?.deviceName ?? "").trim();
  if (!challengeToken) {
    throw new Error("Missing challenge token. Please restart enrollment.");
  }
  if (!payload?.credential) {
    throw new Error("Missing passkey credential.");
  }
  if (!deviceName) {
    throw new Error("Enter a name for this device.");
  }
  return withTokenRefresh((api) =>
    api.auth.passkeyRegisterVerify({
      challengeToken,
      credential: payload.credential,
      deviceName,
    }),
  );
});

export const getPasskeyAuthOptionsServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as { email?: string } | undefined;
  return getServerBackendApi().auth.passkeyAuthOptions({
    email: payload?.email ?? "",
  });
});

export const verifyPasskeyAuthServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as { challengeToken?: string; credential?: unknown; geo?: ClientGeoData } | undefined;
  const challengeToken = String(payload?.challengeToken ?? "").trim();
  if (!challengeToken) {
    throw new Error("Missing challenge token. Please retry sign-in.");
  }
  if (!payload?.credential) {
    throw new Error("Missing passkey assertion.");
  }
  const session = await getServerBackendApi(payload.geo).auth.passkeyAuthVerify({
    challengeToken,
    credential: payload.credential,
  });
  setServerAuthCookies(session);
  authLogger.info("verifyPasskeyAuth success", {
    userId: session.user?.id ?? null,
    hasAccessToken: Boolean(session.accessToken),
    hasRefreshToken: Boolean(session.refreshToken),
  });
  return { ok: true as const, user: session.user };
});

export const listPasskeysServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return withTokenRefresh((api) => api.auth.listPasskeys());
});

export const renamePasskeyServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as { id?: string; deviceName?: string } | undefined;
  const id = String(payload?.id ?? "").trim();
  const deviceName = String(payload?.deviceName ?? "").trim();
  if (!id) throw new Error("Missing passkey id.");
  if (!deviceName) throw new Error("Enter a new device name.");
  return withTokenRefresh((api) => api.auth.renamePasskey(id, deviceName));
});

export const deletePasskeyServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as { id?: string; code?: string } | undefined;
  const id = String(payload?.id ?? "").trim();
  if (!id) throw new Error("Missing passkey id.");
  const code = String(payload?.code ?? "").trim();
  return withTokenRefresh(async (api) => {
    await api.auth.deletePasskey(id, code || undefined);
    return { ok: true } as const;
  });
});

export const startPasskeyRecoveryServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as { email?: string; recoveryCode?: string } | undefined;
  const email = String(payload?.email ?? "").trim();
  const recoveryCode = String(payload?.recoveryCode ?? "").trim();
  if (!email) throw new Error("Email is required.");
  if (!recoveryCode) throw new Error("Recovery code is required.");
  return getServerBackendApi().auth.passkeyRecoverStart({ email, recoveryCode });
});

export const getPasskeyRecoveryDevicesServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as { recoveryToken?: string } | undefined;
  const recoveryToken = String(payload?.recoveryToken ?? "").trim();
  if (!recoveryToken) throw new Error("Missing recovery token.");
  return createRecoveryBackend(recoveryToken).auth.passkeyRecoverDevices(recoveryToken);
});

export const deletePasskeyRecoveryDeviceServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as { recoveryToken?: string; id?: string } | undefined;
  const recoveryToken = String(payload?.recoveryToken ?? "").trim();
  const id = String(payload?.id ?? "").trim();
  if (!recoveryToken) throw new Error("Missing recovery token.");
  if (!id) throw new Error("Missing device id.");
  await createRecoveryBackend(recoveryToken).auth.passkeyRecoverDeleteDevice(recoveryToken, id);
  return { ok: true } as const;
});

export const getPasskeyRecoveryRegisterOptionsServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as { recoveryToken?: string; deviceName?: string } | undefined;
  const recoveryToken = String(payload?.recoveryToken ?? "").trim();
  const deviceName = String(payload?.deviceName ?? "").trim();
  if (!recoveryToken) throw new Error("Missing recovery token.");
  if (!deviceName) throw new Error("Enter a name for this device.");
  return createRecoveryBackend(recoveryToken).auth.passkeyRegisterOptions({
    deviceName,
    authToken: recoveryToken,
  });
});

export const verifyPasskeyRecoveryRegistrationServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as { recoveryToken?: string; challengeToken?: string; credential?: unknown; deviceName?: string } | undefined;
  const recoveryToken = String(payload?.recoveryToken ?? "").trim();
  const challengeToken = String(payload?.challengeToken ?? "").trim();
  const deviceName = String(payload?.deviceName ?? "").trim();
  if (!recoveryToken) throw new Error("Missing recovery token.");
  if (!challengeToken) throw new Error("Missing challenge token.");
  if (!payload?.credential) throw new Error("Missing passkey credential.");
  if (!deviceName) throw new Error("Enter a name for this device.");
  return createRecoveryBackend(recoveryToken).auth.passkeyRegisterVerify({
    challengeToken,
    credential: payload.credential,
    deviceName,
    authToken: recoveryToken,
  });
});

export const completePasskeyRecoveryServerFn = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const payload = data as { recoveryToken?: string } | undefined;
  const recoveryToken = String(payload?.recoveryToken ?? "").trim();
  if (!recoveryToken) throw new Error("Missing recovery token.");
  const session = await createRecoveryBackend(recoveryToken).auth.passkeyRecoverComplete(recoveryToken);
  setServerAuthCookies(session);
  authLogger.info("completePasskeyRecovery success", {
    userId: session.user?.id ?? null,
  });
  return { ok: true as const, user: session.user };
});
