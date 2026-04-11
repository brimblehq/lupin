import { useEffect } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import * as Sentry from "@sentry/tanstackstart-react";
import { BackendApiError } from "@/backend/errors";
import { withWorkspaceQuery } from "@/utils/topbar-navigation";
import { AccessDenied } from "./access-denied";

function isForbiddenError(error: unknown): boolean {
  if (error instanceof BackendApiError) {
    return error.isForbidden;
  }

  // Server functions serialize errors across the network boundary,
  // so instanceof may fail. Fall back to duck-typing.
  const err = error as Record<string, unknown> | null;
  if (err?.code === "HTTP_403" || err?.status === 403) {
    return true;
  }

  // TanStack Start wraps server errors — check the message as last resort
  if (typeof err?.message === "string" && /\b403\b/.test(err.message)) {
    return true;
  }

  return false;
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
  if (isNetworkError(error)) {
    return {
      title: "Can't reach our servers",
      description:
        "Check your internet connection and try again. If the problem persists, our systems may be temporarily unavailable.",
    };
  }

  const err = error as { status?: unknown; code?: unknown } | null;
  const status =
    typeof err?.status === "number" ? err.status : undefined;

  if (status === 404 || err?.code === "HTTP_404") {
    return {
      title: "We couldn't find that page",
      description: "The page you're looking for doesn't exist or may have been moved.",
    };
  }

  if (status && status >= 500) {
    return {
      title: "Something went wrong on our end",
      description:
        "We're looking into it. Please try again in a moment — your data is safe.",
    };
  }

  return {
    title: "Something went wrong",
    description:
      "We hit an unexpected error. Please try again in a moment — if it keeps happening, let us know.",
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
        title="Access Denied"
        description={
          error.message && !/\b403\b/.test(error.message)
            ? error.message
            : "You don't have permission to view this page. Contact the workspace owner if you believe this is a mistake."
        }
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
        onClick: () => router.invalidate(),
      }}
      secondaryAction={{
        label: "Back to dashboard",
        href: withWorkspaceQuery({ pathname: "/", searchStr }),
      }}
    />
  );
}
