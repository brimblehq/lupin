import pino, { type Logger as PinoLogger, type LevelWithSilent } from "pino";

type LogMethod = "debug" | "info" | "warn" | "error";

export interface AppLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  withTag: (tag: string) => AppLogger;
}

const LOG_LEVELS = new Set<LevelWithSilent>([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
]);

function resolveLogLevel(): LevelWithSilent {
  const env = process.env.LOG_LEVEL?.trim().toLowerCase() ?? "";
  if (env && LOG_LEVELS.has(env as LevelWithSilent)) {
    return env as LevelWithSilent;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function serializeError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error.cause !== undefined ? { cause: error.cause } : {}),
  };
}

function normalizeExtra(value: unknown): unknown {
  if (value instanceof Error) {
    return { err: serializeError(value) };
  }
  return value;
}

function emit(
  base: PinoLogger,
  level: LogMethod,
  message: string,
  args: unknown[],
) {
  if (args.length === 0) {
    base[level](message);
    return;
  }

  if (args.length === 1) {
    const [extra] = args;
    if (extra instanceof Error) {
      base[level]({ err: serializeError(extra) }, message);
      return;
    }
    if (extra && typeof extra === "object") {
      base[level](extra as Record<string, unknown>, message);
      return;
    }
    base[level]({ value: extra }, message);
    return;
  }

  const [first, ...rest] = args;
  if (first && typeof first === "object" && !(first instanceof Error)) {
    base[level](
      {
        ...(first as Record<string, unknown>),
        args: rest.map(normalizeExtra),
      },
      message,
    );
    return;
  }

  if (first instanceof Error) {
    base[level](
      {
        err: serializeError(first),
        args: rest.map(normalizeExtra),
      },
      message,
    );
    return;
  }

  base[level](
    {
      value: first,
      args: rest.map(normalizeExtra),
    },
    message,
  );
}

function createAppLogger(base: PinoLogger, currentTag?: string): AppLogger {
  const withTag = (tag: string): AppLogger => {
    const normalized = tag.trim();
    if (!normalized) {
      return createAppLogger(base, currentTag);
    }
    const nextTag = currentTag ? `${currentTag}.${normalized}` : normalized;
    return createAppLogger(base.child({ tag: nextTag }), nextTag);
  };

  return {
    debug: (message, ...args) => emit(base, "debug", message, args),
    info: (message, ...args) => emit(base, "info", message, args),
    warn: (message, ...args) => emit(base, "warn", message, args),
    error: (message, ...args) => emit(base, "error", message, args),
    withTag,
  };
}

const baseLogger = pino({
  level: resolveLogLevel(),
});

export const logger = createAppLogger(baseLogger);
export const authLogger = logger.withTag("auth");
export const domainsLogger = logger.withTag("domains");
export const domainsDnsLogger = logger.withTag("domains.dns");
export const projectsLogger = logger.withTag("projects");
export const workspacesLogger = logger.withTag("workspaces");
export const mcpLogger = logger.withTag("mcp");
export const teamsLogger = logger.withTag("teams");
export const paymentsLogger = logger.withTag("payments");
export const deploymentsLogger = logger.withTag("deployments");
export const settingsLogger = logger.withTag("settings");
export const scalingLogger = logger.withTag("scaling");
export const pricingLogger = logger.withTag("pricing");

export function createModuleLogger(tag: string) {
  return logger.withTag(tag);
}
