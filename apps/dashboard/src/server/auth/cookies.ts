import { createHash } from "node:crypto";
import { deleteCookie, getCookie, setCookie, getRequestHeader } from "@tanstack/react-start/server";
import type { AuthSession } from "@/backend";
import config from "@/config";
import { authLogger } from "@/server/shared/logger";

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: isProduction,
  path: "/",
};

export function tokenFingerprint(token: string | null | undefined): string | null {
  if (!token) {
    return null;
  }

  return createHash("sha256").update(token).digest("hex").slice(0, 8);
}

export function getServerAccessToken(): string | null {
  return getCookie(config.accessTokenCookie) ?? null;
}

export function getServerRefreshToken(): string | null {
  return getCookie(config.refreshTokenCookie) ?? null;
}

export function setServerAuthCookies(session: AuthSession) {
  const existingAccessToken = getServerAccessToken();
  const existingRefreshToken = getServerRefreshToken();

  if (session.accessToken) {
    setCookie(config.accessTokenCookie, session.accessToken, {
      ...cookieOptions,
      maxAge: config.accessTokenTtl,
    });
  }

  if (session.refreshToken) {
    setCookie(config.refreshTokenCookie, session.refreshToken, {
      ...cookieOptions,
      maxAge: config.refreshTokenTtl,
    });
  }

  authLogger.info("setServerAuthCookies", {
    replacedAccessToken: Boolean(existingAccessToken && session.accessToken),
    previousAccessTokenFp: tokenFingerprint(existingAccessToken),
    nextAccessTokenFp: tokenFingerprint(session.accessToken),
    replacedRefreshToken: Boolean(existingRefreshToken && session.refreshToken),
    previousRefreshTokenFp: tokenFingerprint(existingRefreshToken),
    nextRefreshTokenFp: tokenFingerprint(session.refreshToken),
  });
}

export function getServerUserAgent(): string | null {
  try {
    return getRequestHeader("user-agent") ?? null;
  } catch {
    return null;
  }
}

export function getServerClientIp(): string | null {
  try {
    return getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? getRequestHeader("cf-connecting-ip") ?? null;
  } catch {
    return null;
  }
}

export function clearServerAuthCookies() {
  const existingAccessToken = getServerAccessToken();
  const existingRefreshToken = getServerRefreshToken();

  authLogger.warn("clearServerAuthCookies", {
    hadAccessToken: Boolean(existingAccessToken),
    accessTokenFp: tokenFingerprint(existingAccessToken),
    hadRefreshToken: Boolean(existingRefreshToken),
    refreshTokenFp: tokenFingerprint(existingRefreshToken),
  });

  deleteCookie(config.accessTokenCookie, cookieOptions);
  deleteCookie(config.refreshTokenCookie, cookieOptions);
}
