import type { ApiClient } from "./types";
import { notImplemented } from "./utils";

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput {
  firstName: string;
  lastName?: string;
  email: string;
  username: string;
  company?: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface AuthApi {
  login(input: LoginInput): Promise<AuthSession>;
  signup(input: SignupInput): Promise<AuthSession>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;
  requestMagicLink(email: string): Promise<void>;
}

export function createAuthApi(client: ApiClient): AuthApi {
  void client;

  return {
    login: () => notImplemented<AuthSession>("auth", "login"),
    signup: () => notImplemented<AuthSession>("auth", "signup"),
    logout: () => notImplemented<void>("auth", "logout"),
    getCurrentSession: () => notImplemented<AuthSession | null>("auth", "getCurrentSession"),
    requestMagicLink: () => notImplemented<void>("auth", "requestMagicLink"),
  };
}
