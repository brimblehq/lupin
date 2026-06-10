type AblyRealtimeLike = {
  close: () => unknown;
};

let ablyTeardownRejectionFilterInstalled = false;

function isAblyConnectionClosedReason(reason: unknown): boolean {
  const error = reason as { message?: unknown } | null;
  if (typeof error?.message !== "string") return false;
  return error.message === "Connection closed";
}

export function installAblyTeardownRejectionFilter() {
  if (typeof window === "undefined" || ablyTeardownRejectionFilterInstalled) return;

  ablyTeardownRejectionFilterInstalled = true;
  window.addEventListener("unhandledrejection", (event) => {
    if (isAblyConnectionClosedReason(event.reason)) {
      event.preventDefault();
    }
  });
}

export function safeCloseAblyRealtime(ably: AblyRealtimeLike) {
  try {
    void Promise.resolve(ably.close()).catch(() => {});
  } catch {
    // Ably can throw during teardown when the connection is already closed.
  }
}
