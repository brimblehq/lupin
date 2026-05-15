import type { ApiClient } from "./types";
import type {
  AuthApi,
  AuthSession,
  ConfirmDeleteAccountInput,
  PasskeyAuthOptionsInput,
  PasskeyAuthOptionsResult,
  PasskeyAuthVerifyInput,
  PasskeyFeatureStatus,
  PasskeyRecoverStartInput,
  PasskeyRecoverStartResult,
  PasskeyRecoveryDevice,
  PasskeyRegisterOptionsInput,
  PasskeyRegisterOptionsResult,
  PasskeyRegisterVerifyInput,
  PasskeySummary,
  TwoFactorCodeInput,
  TwoFactorSetup,
  TwoFactorStatus,
  VerifyEmailCodeResult,
} from "./auth/types";
export type {
  AuthApi,
  AuthSession,
  AuthUser,
  ConfirmDeleteAccountInput,
  LoginInput,
  PasskeyAuthOptionsResult,
  PasskeyFeatureStatus,
  PasskeyRecoverStartResult,
  PasskeyRecoveryDevice,
  PasskeyRegisterOptionsResult,
  PasskeySummary,
  SignupInput,
  TwoFactorCodeInput,
  TwoFactorSetup,
  TwoFactorStatus,
  UserLookupInput,
  UserLookupResult,
  VerifyEmailCodeInput,
  VerifyEmailCodeResult,
  VerifyTwoFactorChallengeInput,
} from "./auth/types";
import { BackendApiError } from "./errors";

export function createAuthApi(client: ApiClient): AuthApi {
  const endpoints = {
    login: "/auth/beta/login",
    signup: "/auth/beta/signup",
    verifyEmail: "/auth/beta/verify-email",
    refresh: "/auth/beta/refresh",
    logoutAuth: "/auth/beta/logout",
    me: "/auth/user/me",
    lookup: "/auth/beta/lookup",
    deleteAccount: "/auth/user/delete-account",
    twoFactorStatus: "/auth/2fa/status",
    twoFactorSetup: "/auth/2fa/setup",
    twoFactorVerifySetup: "/auth/2fa/verify-setup",
    twoFactorDisable: "/auth/2fa/disable",
    twoFactorVerify: "/auth/2fa/verify",
    twoFactorRegenerateRecoveryCodes: "/auth/2fa/recovery-codes/regenerate",
    twoFactorStepUp: "/auth/2fa/step-up",
    passkeyRegisterOptions: "/auth/passkey/register/options",
    passkeyRegisterVerify: "/auth/passkey/register/verify",
    passkeyAuthOptions: "/auth/passkey/auth/options",
    passkeyAuthVerify: "/auth/passkey/auth/verify",
    passkeyList: "/auth/passkey",
    passkeyById: (id: string) => `/auth/passkey/${encodeURIComponent(id)}`,
    passkeyRecoverStart: "/auth/passkey/recover",
    passkeyRecoverDevices: "/auth/passkey/recover/devices",
    passkeyRecoverDeviceById: (id: string) => `/auth/passkey/recover/devices/${encodeURIComponent(id)}`,
    passkeyRecoverComplete: "/auth/passkey/recover/complete",
  } as const;

  const normalizeEmail = (email: string) => email.trim().toLowerCase();

  const mapSession = (payload: any): AuthSession => {
    const data = payload?.data?.data ?? payload?.data ?? payload;
    const firstName = data?.first_name ?? data?.firstName;
    const lastName = data?.last_name ?? data?.lastName;

    return {
      accessToken: data?.access_token ?? data?.accessToken,
      refreshToken: data?.refresh_token ?? data?.refreshToken,
      user: {
        id: String(data?.id ?? ""),
        email: String(data?.email ?? ""),
        username: data?.username,
        firstName,
        lastName,
        company: data?.company,
        name: [firstName, lastName].filter(Boolean).join(" ") || data?.name,
        onboarded: Boolean(data?.onboard?.user ?? data?.onboarded),
      },
    };
  };

  const parseTwoFactorChallenge = (payload: any): VerifyEmailCodeResult | null => {
    const data = payload?.data?.data ?? payload?.data ?? payload;
    const challengeToken = String(data?.challenge_token ?? data?.challengeToken ?? "").trim();
    const requiresTwoFactor = Boolean(data?.requires_2fa ?? data?.requiresTwoFactor ?? data?.requires2fa);

    if (!requiresTwoFactor && !challengeToken) {
      return null;
    }

    if (!challengeToken) {
      throw new Error("Two-factor challenge token is missing");
    }

    const expiresIn = Number.parseInt(String(data?.expires_in ?? data?.expiresIn ?? "300"), 10);

    return {
      requiresTwoFactor: true,
      challengeToken,
      expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 300,
    };
  };

  const mapTwoFactorStatus = (payload: any): TwoFactorStatus => {
    const data = payload?.data?.data ?? payload?.data ?? payload;
    return {
      enabled: Boolean(data?.enabled),
      hasRecoveryCodes: Boolean(data?.has_recovery_codes ?? data?.hasRecoveryCodes),
      recoveryCodesRemaining: Number(data?.recovery_codes_remaining ?? data?.recoveryCodesRemaining ?? 0),
    };
  };

  const mapTwoFactorSetup = (payload: any): TwoFactorSetup => {
    const data = payload?.data?.data ?? payload?.data ?? payload;
    const recoveryCodes = Array.isArray(data?.recovery_codes)
      ? data.recovery_codes
      : Array.isArray(data?.recoveryCodes)
        ? data.recoveryCodes
        : [];

    return {
      secret: String(data?.secret ?? ""),
      provisioningUri: String(data?.provisioning_uri ?? data?.provisioningUri ?? ""),
      qrCode: String(data?.qr_code ?? data?.qrCode ?? ""),
      recoveryCodes: recoveryCodes.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean),
    };
  };

  const mapPasskeySummary = (raw: any): PasskeySummary => {
    const data = raw ?? {};
    return {
      id: String(data?.id ?? ""),
      deviceName: String(data?.device_name ?? data?.deviceName ?? ""),
      transports: Array.isArray(data?.transports) ? data.transports.map((t: unknown) => String(t)) : [],
      createdAt: data?.created_at ?? data?.createdAt ?? undefined,
      lastUsedAt: data?.last_used_at ?? data?.lastUsedAt ?? undefined,
    };
  };

  const mapPasskeyRecoveryDevice = (raw: any): PasskeyRecoveryDevice => {
    const data = raw ?? {};
    return {
      id: String(data?.id ?? ""),
      deviceName: String(data?.device_name ?? data?.deviceName ?? ""),
      createdAt: data?.created_at ?? data?.createdAt ?? undefined,
      lastUsedAt: data?.last_used_at ?? data?.lastUsedAt ?? undefined,
    };
  };

  const unwrapData = (payload: any) => payload?.data?.data ?? payload?.data ?? payload;

  const bearerHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  const mapRecoveryCodes = (payload: any): string[] => {
    const data = payload?.data?.data ?? payload?.data ?? payload;
    const recoveryCodes = Array.isArray(data?.recovery_codes)
      ? data.recovery_codes
      : Array.isArray(data?.recoveryCodes)
        ? data.recoveryCodes
        : [];

    return recoveryCodes.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean);
  };

  return {
    async login(input) {
      await client.request(endpoints.login, {
        method: "POST",
        body: { email: normalizeEmail(input.email) },
      });
    },
    async signup(input) {
      await client.request(endpoints.signup, {
        method: "POST",
        body: {
          email: normalizeEmail(input.email),
          username: input.username.trim(),
          first_name: input.firstName?.trim() || input.username.trim(),
          last_name: input.lastName?.trim() || undefined,
          company: input.company?.trim() || undefined,
        },
      });
    },
    async verifyEmailCode(input) {
      const response = await client.request(endpoints.verifyEmail, {
        method: "POST",
        body: {
          email: normalizeEmail(input.email),
          access_code: input.code,
        },
      });

      const challenge = parseTwoFactorChallenge(response);
      if (challenge) {
        return challenge;
      }

      return {
        requiresTwoFactor: false,
        session: mapSession(response),
      };
    },
    async verifyTwoFactorChallenge(input) {
      const response = await client.request(endpoints.twoFactorVerify, {
        method: "POST",
        body: {
          challenge_token: input.challengeToken,
          code: String(input.code ?? "").trim(),
        },
        headers: { Authorization: "" },
      });

      return mapSession(response);
    },
    async getTwoFactorStatus() {
      const response = await client.request(endpoints.twoFactorStatus, {
        method: "GET",
      });
      return mapTwoFactorStatus(response);
    },
    async startTwoFactorSetup() {
      const response = await client.request(endpoints.twoFactorSetup, {
        method: "POST",
      });
      return mapTwoFactorSetup(response);
    },
    async verifyTwoFactorSetup(input: TwoFactorCodeInput) {
      await client.request(endpoints.twoFactorVerifySetup, {
        method: "POST",
        body: {
          code: String(input.code ?? "").trim(),
        },
      });
    },
    async disableTwoFactor(input: TwoFactorCodeInput) {
      await client.request(endpoints.twoFactorDisable, {
        method: "POST",
        body: {
          code: String(input.code ?? "").trim(),
        },
      });
    },
    async regenerateTwoFactorRecoveryCodes(input: TwoFactorCodeInput) {
      const response = await client.request(endpoints.twoFactorRegenerateRecoveryCodes, {
        method: "POST",
        body: {
          code: String(input.code ?? "").trim(),
        },
      });
      return mapRecoveryCodes(response);
    },
    async stepUpTwoFactor(input) {
      const response = await client.request(endpoints.twoFactorStepUp, {
        method: "POST",
        body: {
          code: input.code.trim(),
          action: input.action,
          resource_id: input.resourceId,
        },
      });
      const data = (response as any)?.data?.data ?? (response as any)?.data ?? response;
      return {
        token: String(data.token),
        expiresIn: Number(data.expires_in),
      };
    },
    async resendCode(email) {
      await client.request(endpoints.login, {
        method: "POST",
        body: { email: normalizeEmail(email) },
      });
    },
    async requestDeleteAccountCode(turnstileToken?: string) {
      await client.request(endpoints.deleteAccount, {
        method: "POST",
        body: { turnstile_token: turnstileToken },
      });
    },
    async confirmDeleteAccount(input: ConfirmDeleteAccountInput) {
      const normalizedCode = String(input.accessCode ?? "").trim();
      await client.request(endpoints.deleteAccount, {
        method: "DELETE",
        body: {
          access_code: Number(normalizedCode),
        },
      });
    },
    async lookup(input) {
      let query: { email: string } | { username: string } | null = null;

      if (input.email?.trim()) {
        query = { email: normalizeEmail(input.email) };
      } else if (input.username?.trim()) {
        query = { username: input.username.trim() };
      }

      if (!query) {
        return { available: false, message: "Email or username is required" };
      }

      try {
        await client.request(endpoints.lookup, {
          method: "GET",
          query,
        });
        return { available: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Lookup request failed";
        return { available: false, message };
      }
    },
    async checkUsername(username) {
      const response = await client.request<any>(`/auth/user/${encodeURIComponent(username)}`, {
        method: "GET",
      });
      const data = response?.data?.data ?? response?.data;
      return { exists: Boolean(data?.exists) };
    },
    async refreshTokens(refreshToken) {
      const response = await client.request(endpoints.refresh, {
        method: "POST",
        body: { refresh_token: refreshToken },
        headers: { Authorization: "" },
      });
      return mapSession(response);
    },
    async logout(refreshToken?) {
      await client.request(endpoints.logoutAuth, {
        method: "POST",
        body: refreshToken ? { refresh_token: refreshToken } : {},
      });
    },
    async getCurrentSession() {
      try {
        const response = await client.request(endpoints.me, {
          method: "GET",
        });
        return mapSession(response);
      } catch (error: any) {
        if (error?.status === 401 || error?.status === 403) {
          return null;
        }

        throw error;
      }
    },

    async getPasskeyFeatureStatus() {
      try {
        await client.request(endpoints.passkeyAuthOptions, {
          method: "POST",
          body: { email: "" },
          headers: { Authorization: "" },
        });
        return { enabled: true } satisfies PasskeyFeatureStatus;
      } catch (error) {
        if (error instanceof BackendApiError && error.status === 404) {
          return { enabled: false } satisfies PasskeyFeatureStatus;
        }
        // Other errors (e.g. 400 from empty email) still indicate the feature is on.
        if (error instanceof BackendApiError && error.status && error.status !== 404) {
          return { enabled: true } satisfies PasskeyFeatureStatus;
        }
        throw error;
      }
    },

    async passkeyRegisterOptions(input: PasskeyRegisterOptionsInput) {
      const headers = input.authToken ? bearerHeaders(input.authToken) : undefined;
      const response = await client.request(endpoints.passkeyRegisterOptions, {
        method: "POST",
        body: { device_name: input.deviceName },
        headers,
      });
      const data = unwrapData(response);
      return {
        options: (data?.options ?? {}) as Record<string, unknown>,
        challengeToken: String(data?.challenge_token ?? data?.challengeToken ?? ""),
      } satisfies PasskeyRegisterOptionsResult;
    },

    async passkeyRegisterVerify(input: PasskeyRegisterVerifyInput) {
      const headers = input.authToken ? bearerHeaders(input.authToken) : undefined;
      const response = await client.request(endpoints.passkeyRegisterVerify, {
        method: "POST",
        body: {
          challenge_token: input.challengeToken,
          credential: input.credential,
          device_name: input.deviceName,
        },
        headers,
      });
      const data = unwrapData(response);
      return mapPasskeySummary(data?.passkey ?? data);
    },

    async passkeyAuthOptions(input: PasskeyAuthOptionsInput) {
      const normalizedEmail = String(input.email ?? "").trim();
      const response = await client.request(endpoints.passkeyAuthOptions, {
        method: "POST",
        body: { email: normalizedEmail ? normalizeEmail(normalizedEmail) : "" },
        headers: { Authorization: "" },
      });
      const data = unwrapData(response);
      return {
        options: (data?.options ?? {}) as Record<string, unknown>,
        challengeToken: String(data?.challenge_token ?? data?.challengeToken ?? ""),
      } satisfies PasskeyAuthOptionsResult;
    },

    async passkeyAuthVerify(input: PasskeyAuthVerifyInput) {
      const response = await client.request(endpoints.passkeyAuthVerify, {
        method: "POST",
        body: {
          challenge_token: input.challengeToken,
          credential: input.credential,
        },
        headers: { Authorization: "" },
      });
      return mapSession(response);
    },

    async listPasskeys() {
      const response = await client.request(endpoints.passkeyList, {
        method: "GET",
      });
      const data = unwrapData(response);
      const list = Array.isArray(data?.passkeys) ? data.passkeys : Array.isArray(data) ? data : [];
      return list.map(mapPasskeySummary);
    },

    async renamePasskey(id: string, deviceName: string) {
      const response = await client.request(endpoints.passkeyById(id), {
        method: "PATCH",
        body: { device_name: deviceName },
      });
      const data = unwrapData(response);
      return mapPasskeySummary(data?.passkey ?? data);
    },

    async deletePasskey(id: string, code?: string) {
      await client.request(endpoints.passkeyById(id), {
        method: "DELETE",
        body: code ? { code } : undefined,
      });
    },

    async passkeyRecoverStart(input: PasskeyRecoverStartInput) {
      const response = await client.request(endpoints.passkeyRecoverStart, {
        method: "POST",
        body: {
          email: normalizeEmail(input.email),
          recovery_code: input.recoveryCode.trim(),
        },
        headers: { Authorization: "" },
      });
      const data = unwrapData(response);
      const expiresIn = Number.parseInt(String(data?.expires_in ?? data?.expiresIn ?? "600"), 10);
      return {
        recoveryToken: String(data?.access_token ?? data?.accessToken ?? ""),
        expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 600,
      } satisfies PasskeyRecoverStartResult;
    },

    async passkeyRecoverDevices(recoveryToken: string) {
      const response = await client.request(endpoints.passkeyRecoverDevices, {
        method: "GET",
        headers: bearerHeaders(recoveryToken),
      });
      const data = unwrapData(response);
      const list = Array.isArray(data?.devices) ? data.devices : Array.isArray(data) ? data : [];
      return list.map(mapPasskeyRecoveryDevice);
    },

    async passkeyRecoverDeleteDevice(recoveryToken: string, id: string) {
      await client.request(endpoints.passkeyRecoverDeviceById(id), {
        method: "DELETE",
        headers: bearerHeaders(recoveryToken),
      });
    },

    async passkeyRecoverComplete(recoveryToken: string) {
      const response = await client.request(endpoints.passkeyRecoverComplete, {
        method: "POST",
        headers: bearerHeaders(recoveryToken),
      });
      return mapSession(response);
    },
  };
}
