import { useEffect } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import * as Sentry from "@sentry/tanstackstart-react";
import { BackendApiError } from "@/backend/errors";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { AccessDenied } from "./access-denied";
import { invalidateActiveMatches } from "@/utils/router-invalidate";

const HTTP_STATUS_PREFIX = /^\[HTTP (\d{3})\]\s*/;

function getHttpStatus(error: unknown): number | undefined {
  const err = error as { status?: unknown; message?: unknown; stack?: unknown } | null;
  if (typeof err?.status === "number") return err.status;
  if (typeof err?.message === "string") {
    const match = err.message.match(HTTP_STATUS_PREFIX);
    if (match) return Number(match[1]);
  }
  if (typeof err?.stack === "string") {
    const match = err.stack.match(HTTP_STATUS_PREFIX);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function isForbiddenError(error: unknown): boolean {
  if (error instanceof BackendApiError) {
    return error.isForbidden;
  }
  const err = error as Record<string, unknown> | null;
  if (err?.code === "HTTP_403") return true;
  return getHttpStatus(error) === 403;
}

function isNetworkError(error: unknown): boolean {
  const err = error as { name?: unknown; message?: unknown } | null;
  const name = typeof err?.name === "string" ? err.name : "";
  const message = typeof err?.message === "string" ? err.message.toLowerCase() : "";
  return (
    name === "TypeError" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("load failed")
  );
}

function getFriendlyError(error: unknown): { title: string; description: string } {
  console.log(`ERROR: APPLICATION HERE HERE ->`, error);

  if (isNetworkError(error)) {
    return {
      title: "Can't reach our servers",
      description: "Check your internet connection and try again. If the problem persists, our systems may be temporarily unavailable.",
    };
  }

  const status = getHttpStatus(error);

  if (status === 404) {
    return {
      title: "We couldn't find that page",
      description: "The page you're looking for doesn't exist or may have been moved.",
    };
  }

  if (status && status >= 500) {
    return {
      title: "Something went wrong on our end",
      description: "We're looking into it. Please try again in a moment — your data is safe.",
    };
  }

  return {
    title: "Something went wrong",
    description: "We hit an unexpected error. Please try again in a moment — if it keeps happening, let us know.",
  };
}

export function DefaultErrorComponent({ error }: { error: Error }) {
  const router = useRouter();
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const forbidden = isForbiddenError(error);

  useEffect(() => {
    if (!forbidden) {
      Sentry.captureException(error);
    }
  }, [error, forbidden]);

  if (forbidden) {
    return (
      <AccessDenied
        imageSrc="/images/error.svg"
        title="Access Denied"
        description="You don't have permission to view this resource. Reach out to a workspace admin to request an invite or access."
      />
    );
  }

  const friendly = getFriendlyError(error);

  return (
    <AccessDenied
      imageSrc="/images/error.svg"
      title={friendly.title}
      description={friendly.description}
      action={{
        label: "Try again",
        onClick: () => {
          void invalidateActiveMatches(router);
        },
      }}
      secondaryAction={{
        label: "Back to dashboard",
        href: withWorkspaceQuery({ pathname: "/", searchStr }),
      }}
    />
  );
}
