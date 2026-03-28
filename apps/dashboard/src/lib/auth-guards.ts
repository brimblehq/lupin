import { redirect } from "@tanstack/react-router";
import { getCurrentSessionServerFn, refreshSessionServerFn } from "@/server/auth/actions";
import {
  clearSessionCache,
  hasAccessTokenCookie,
  isSessionRecentlyVerified,
  markSessionVerified,
} from "./auth-cache";

const publicRoutes = new Set<string>(["/login", "/signup"]);

function buildNextPath(pathname: string, search?: string) {
  if (!search) {
    return pathname;
  }

  if (search.startsWith("?")) {
    return `${pathname}${search}`;
  }

  return `${pathname}?${search}`;
}

export function invalidateSessionCache() {
  clearSessionCache();
}

export async function enforceRouteAuth(pathname: string, search?: string) {
  const isPublicRoute = publicRoutes.has(pathname);

  if (!isPublicRoute && hasAccessTokenCookie() && isSessionRecentlyVerified()) {
    return { session: true };
  }

  if (isPublicRoute && hasAccessTokenCookie() && isSessionRecentlyVerified()) {
    const nextParam = new URLSearchParams(
      search?.startsWith("?") ? search : `?${search || ""}`,
    ).get("next");
    throw redirect({ to: nextParam || "/" });
  }

  let session: unknown = null;
  let authCheckFailed = false;

  try {
    session = await getCurrentSessionServerFn();
  } catch (error) {
    authCheckFailed = true;
    console.warn("[auth] enforceRouteAuth session check failed", error);
  }

  if (!session && !authCheckFailed) {
    session = await refreshSessionServerFn();
  }

  if (session) {
    markSessionVerified();
  }

  if (!session && !isPublicRoute && !authCheckFailed) {
    clearSessionCache();
    throw redirect({
      to: "/login",
      search: {
        next: buildNextPath(pathname, search),
      },
    });
  }

  if (session && isPublicRoute) {
    const nextParam = new URLSearchParams(search?.startsWith("?") ? search : `?${search || ""}`).get("next");
    throw redirect({ to: nextParam || "/" });
  }

  return { session };
}
