export interface LoginInput {
  email: string;
}

export interface SignupInput {
  firstName?: string;
  lastName?: string;
  email: string;
  username: string;
  company?: string;
}

export interface VerifyEmailCodeInput {
  email: string;
  code: string;
}

export interface VerifyTwoFactorChallengeInput {
  challengeToken: string;
  code: string;
}

export interface TwoFactorCodeInput {
  code: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  hasRecoveryCodes: boolean;
  recoveryCodesRemaining: number;
}

export interface TwoFactorSetup {
  secret: string;
  provisioningUri: string;
  qrCode: string;
  recoveryCodes: string[];
}

export interface VerifyEmailCodeChallenge {
  requiresTwoFactor: true;
  challengeToken: string;
  expiresIn: number;
}

export interface VerifyEmailCodeSession {
  requiresTwoFactor: false;
  session: AuthSession;
}

export type VerifyEmailCodeResult = VerifyEmailCodeSession | VerifyEmailCodeChallenge;

export interface ConfirmDeleteAccountInput {
  accessCode: string | number;
}

export interface UserLookupInput {
  email?: string;
  username?: string;
}

export interface UserLookupResult {
  available: boolean;
  message?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  name?: string;
  onboarded?: boolean;
}

export interface AuthSession {
  accessToken?: string;
  refreshToken?: string;
  user: AuthUser;
}

export interface PasskeySummary {
  id: string;
  deviceName: string;
  transports: string[];
  createdAt?: string;
  lastUsedAt?: string;
}

export interface PasskeyRegisterOptionsResult {
  options: Record<string, unknown>;
  challengeToken: string;
}

export interface PasskeyAuthOptionsResult {
  options: Record<string, unknown>;
  challengeToken: string;
}

export interface PasskeyRegisterOptionsInput {
  deviceName: string;
  authToken?: string;
}

export interface PasskeyRegisterVerifyInput {
  challengeToken: string;
  credential: unknown;
  deviceName: string;
  authToken?: string;
}

export interface PasskeyAuthOptionsInput {
  email?: string;
}

export interface PasskeyAuthVerifyInput {
  challengeToken: string;
  credential: unknown;
}

export interface PasskeyRecoverStartInput {
  email: string;
  recoveryCode: string;
}

export interface PasskeyRecoverStartResult {
  recoveryToken: string;
  expiresIn: number;
}

export interface PasskeyRecoveryDevice {
  id: string;
  deviceName: string;
  createdAt?: string;
  lastUsedAt?: string;
}

export interface PasskeyFeatureStatus {
  enabled: boolean;
}

export interface AuthApi {
  login(input: LoginInput): Promise<void>;
  signup(input: SignupInput): Promise<void>;
  verifyEmailCode(input: VerifyEmailCodeInput): Promise<VerifyEmailCodeResult>;
  verifyTwoFactorChallenge(input: VerifyTwoFactorChallengeInput): Promise<AuthSession>;
  getTwoFactorStatus(): Promise<TwoFactorStatus>;
  startTwoFactorSetup(): Promise<TwoFactorSetup>;
  verifyTwoFactorSetup(input: TwoFactorCodeInput): Promise<void>;
  disableTwoFactor(input: TwoFactorCodeInput): Promise<void>;
  regenerateTwoFactorRecoveryCodes(input: TwoFactorCodeInput): Promise<string[]>;
  stepUpTwoFactor(input: { code: string; action: string; resourceId: string }): Promise<{ token: string; expiresIn: number }>;
  resendCode(email: string): Promise<void>;
  requestDeleteAccountCode(turnstileToken?: string): Promise<void>;
  confirmDeleteAccount(input: ConfirmDeleteAccountInput): Promise<void>;
  lookup(input: UserLookupInput): Promise<UserLookupResult>;
  checkUsername(username: string): Promise<{ exists: boolean }>;
  refreshTokens(refreshToken: string): Promise<AuthSession>;
  logout(refreshToken?: string): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;

  getPasskeyFeatureStatus(): Promise<PasskeyFeatureStatus>;
  passkeyRegisterOptions(input: PasskeyRegisterOptionsInput): Promise<PasskeyRegisterOptionsResult>;
  passkeyRegisterVerify(input: PasskeyRegisterVerifyInput): Promise<PasskeySummary>;
  passkeyAuthOptions(input: PasskeyAuthOptionsInput): Promise<PasskeyAuthOptionsResult>;
  passkeyAuthVerify(input: PasskeyAuthVerifyInput): Promise<AuthSession>;
  listPasskeys(): Promise<PasskeySummary[]>;
  renamePasskey(id: string, deviceName: string): Promise<PasskeySummary>;
  deletePasskey(id: string): Promise<void>;
  passkeyRecoverStart(input: PasskeyRecoverStartInput): Promise<PasskeyRecoverStartResult>;
  passkeyRecoverDevices(recoveryToken: string): Promise<PasskeyRecoveryDevice[]>;
  passkeyRecoverDeleteDevice(recoveryToken: string, id: string): Promise<void>;
  passkeyRecoverComplete(recoveryToken: string): Promise<AuthSession>;
}
