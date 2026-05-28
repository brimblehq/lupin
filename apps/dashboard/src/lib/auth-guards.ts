import { redirect } from "@tanstack/react-router";
import { getCurrentSessionServerFn, refreshSessionServerFn } from "@/server/auth/actions";
import { logAuthFlow, warnAuthFlow } from "@/lib/auth-flow-logger";
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
  logAuthFlow("session cache invalidated");
}

type EnforceRouteAuthOptions = {
  preload?: boolean;
};

export async function enforceRouteAuth(pathname: string, search?: string, options?: EnforceRouteAuthOptions) {
  const isPublicRoute = publicRoutes.has(pathname);
  const isTwoFactorRoute = pathname === "/2fa";
  const isPreload = options?.preload === true;
  const recentlyVerified = isSessionRecentlyVerified();
  const routeMeta = {
    pathname,
    hasSearch: Boolean(search),
    isPublicRoute,
    isTwoFactorRoute,
    isPreload,
    recentlyVerified,
  };

  logAuthFlow("enforce route auth start", routeMeta);

  if (isPreload) {
    logAuthFlow("skipping auth check for preload", { pathname });
    return { session: null };
  }

  if (!isPublicRoute && recentlyVerified) {
    logAuthFlow("skipping auth check due to recent verification cache", { pathname });
    return { session: null };
  }

  if (isPublicRoute && !isTwoFactorRoute && recentlyVerified) {
    const nextParam = new URLSearchParams(search?.startsWith("?") ? search : `?${search || ""}`).get("next");
    logAuthFlow("redirecting away from public auth route due to active session cache", {
      pathname,
      redirectTo: nextParam || "/",
    });
    throw redirect({ to: nextParam || "/" });
  }

  let session: unknown = null;
  let authCheckFailed = false;
  let refreshStatus: "ok" | "missing" | "expired" | "error" | null = null;

  try {
    session = await getCurrentSessionServerFn();
    logAuthFlow("session check completed", {
      pathname,
      hasSession: Boolean(session),
    });
  } catch (error) {
    authCheckFailed = true;
    warnAuthFlow("session check failed", {
      pathname,
      error,
    });
  }

  if (!session) {
    const refreshResult = await refreshSessionServerFn();
    refreshStatus = refreshResult?.status ?? null;
    logAuthFlow("refresh session attempt completed", {
      pathname,
      refreshStatus,
    });

    if (refreshResult?.status === "ok") {
      session = {
        user: refreshResult.user,
      };
    }
  }

  if (session) {
    markSessionVerified();
    logAuthFlow("session verified and cache marked", { pathname });
  }

  const shouldRedirectToLogin =
    !session &&
    !isPublicRoute &&
    (refreshStatus === "expired" || refreshStatus === "missing" || refreshStatus === "error" || authCheckFailed);

  if (shouldRedirectToLogin) {
    clearSessionCache();
    warnAuthFlow("redirecting to login because no valid session", {
      pathname,
      refreshStatus,
      authCheckFailed,
    });
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
    logAuthFlow("redirecting authenticated user away from public auth route", {
      pathname,
      redirectTo: nextParam || "/",
    });
    throw redirect({ to: nextParam || "/" });
  }

  logAuthFlow("enforce route auth complete", {
    pathname,
    hasSession: Boolean(session),
  });
  return { session };
}
