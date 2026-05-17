import { redirect } from "@tanstack/react-router";
import { getCurrentSessionServerFn, refreshSessionServerFn } from "@/server/auth/actions";
import { clearSessionCache, isSessionRecentlyVerified, markSessionVerified } from "./auth-cache";

const publicRoutes = new Set<string>(["/login", "/signup", "/2fa"]);

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

type EnforceRouteAuthOptions = {
  preload?: boolean;
};

export async function enforceRouteAuth(pathname: string, search?: string, options?: EnforceRouteAuthOptions) {
  const isPublicRoute = publicRoutes.has(pathname);
  const isTwoFactorRoute = pathname === "/2fa";
  const isPreload = options?.preload === true;
  const recentlyVerified = isSessionRecentlyVerified();

  if (isPreload) {
    return { session: null };
  }

  if (!isPublicRoute && recentlyVerified) {
    return { session: null };
  }

  if (isPublicRoute && !isTwoFactorRoute && recentlyVerified) {
    const nextParam = new URLSearchParams(search?.startsWith("?") ? search : `?${search || ""}`).get("next");
    throw redirect({ to: nextParam || "/" });
  }

  let session: unknown = null;
  let authCheckFailed = false;
  let refreshStatus: "ok" | "missing" | "expired" | "error" | null = null;

  try {
    session = await getCurrentSessionServerFn();
  } catch (error) {
    authCheckFailed = true;
    console.warn("[auth] enforceRouteAuth session check failed", error);
  }

  if (!session) {
    const refreshResult = await refreshSessionServerFn();
    refreshStatus = refreshResult?.status ?? null;
    if (refreshResult?.status === "ok") {
      session = {
        user: refreshResult.user,
      };
    }
  }

  if (session) {
    markSessionVerified();
  }

  const shouldRedirectToLogin =
    !session &&
    !isPublicRoute &&
    (refreshStatus === "expired" || refreshStatus === "missing" || refreshStatus === "error" || authCheckFailed);

  if (shouldRedirectToLogin) {
    clearSessionCache();
    throw redirect({
      to: "/login",
      search: {
        next: buildNextPath(pathname, search),
        ...(refreshStatus === "expired" ? { reason: "session-expired" } : {}),
      },
    });
  }

  if (session && isPublicRoute && !isTwoFactorRoute) {
    const nextParam = new URLSearchParams(search?.startsWith("?") ? search : `?${search || ""}`).get("next");
    throw redirect({ to: nextParam || "/" });
  }

  return { session };
}
