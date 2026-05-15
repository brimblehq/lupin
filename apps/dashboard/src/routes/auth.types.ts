import type {
  AuthSession,
  LoginInput,
  PasskeyAuthOptionsResult,
  SignupInput,
  UserLookupInput,
  UserLookupResult,
  VerifyEmailCodeInput,
} from "@/backend/auth/types";
import type { ClientGeoInfo } from "@/lib/client-geo";

type AuthGeo = ClientGeoInfo | null;

type ServerFnCaller<TData, TResult> = (args: { data: TData }) => Promise<TResult>;

type AuthUserPreview = Pick<AuthSession["user"], "firstName">;

export type LookupAuthCaller = ServerFnCaller<UserLookupInput, UserLookupResult>;

export type StartSignupCaller = ServerFnCaller<Pick<SignupInput, "email" | "username"> & { geo?: AuthGeo }, { ok: true }>;

export type RequestLoginOtpCaller = ServerFnCaller<LoginInput & { geo?: AuthGeo }, { ok: true }>;

export type ResendAuthCodeCaller = ServerFnCaller<LoginInput & { geo?: AuthGeo }, { ok: true }>;

export type VerifyEmailCodeCaller = ServerFnCaller<
  VerifyEmailCodeInput & { geo?: AuthGeo },
  | {
      ok: true;
      requiresTwoFactor: true;
      challengeToken: string;
      expiresIn: number;
    }
  | {
      ok: true;
      requiresTwoFactor: false;
      user: AuthUserPreview;
    }
>;

export type FinalizeOauthSessionCaller = ServerFnCaller<
  {
    accessToken: string;
    refreshToken?: string;
    user?: Partial<AuthSession["user"]>;
    geo?: AuthGeo;
  },
  { ok: true; user: AuthUserPreview }
>;

export type GetPasskeyAuthOptionsCaller = ServerFnCaller<{ email?: string }, PasskeyAuthOptionsResult>;

export type VerifyPasskeyAuthCaller = ServerFnCaller<
  {
    challengeToken: string;
    credential: unknown;
    geo?: AuthGeo;
  },
  { ok: true; user: AuthUserPreview }
>;
