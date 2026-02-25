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

  return (
    <AccessDenied
      imageSrc="/images/error.svg"
      title="That shouldn't have happened."
      description={error.message || "An unexpected error occurred. Please try again."}
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
