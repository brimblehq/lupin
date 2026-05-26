const AUTH_FLOW_LOG_PREFIX = "[auth-flow]";

function formatMessage(message: string): string {
  return `${AUTH_FLOW_LOG_PREFIX} ${message}`;
}

export function logAuthFlow(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.info(formatMessage(message), meta);
    return;
  }

  console.info(formatMessage(message));
}

export function warnAuthFlow(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.warn(formatMessage(message), meta);
    return;
  }

  console.warn(formatMessage(message));
}
