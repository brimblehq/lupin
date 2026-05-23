import { asRecord, pickNonEmptyString, pickNumber, pickString } from "@/backend/normalize";
import type { TerminalExecDoneFrame, TerminalExecStreamFrame, TerminalSessionResponse } from "./terminal-session-types";

const SESSION_EXPIRED_STATUS = 400;
const SESSION_NOT_FOUND_STATUS = 404;

interface TerminalHttpError extends Error {
  status: number;
}

interface TerminalSessionRequestOptions {
  apiBaseUrl: string;
  sandboxId: string;
  token: string;
}

interface CreateTerminalSessionInput {
  cwd?: string;
  timeout_seconds?: number;
  ttl_seconds?: number;
}

interface ExecTerminalCommandInput extends TerminalSessionRequestOptions {
  sessionId: string;
  cmd: string;
  cwd?: string;
  timeout_seconds?: number;
  signal?: AbortSignal;
  onStdout: (chunk: string) => void;
  onStderr: (chunk: string) => void;
}

function createTerminalHttpError(message: string, status: number): TerminalHttpError {
  const error = new Error(message) as TerminalHttpError;
  error.status = status;
  return error;
}

function parseSessionResponse(value: unknown): TerminalSessionResponse {
  const root = asRecord(value);
  const data = asRecord(root?.data) ?? root;
  if (!data) {
    throw new Error("Invalid terminal session response");
  }

  const session_id = pickNonEmptyString(data, "session_id");
  const sandbox_id = pickNonEmptyString(data, "sandbox_id");
  const cwd = pickString(data, "cwd");
  const timeout_seconds = pickNumber(data, "timeout_seconds");
  const created_at = pickNonEmptyString(data, "created_at");
  const last_used_at = pickNonEmptyString(data, "last_used_at");
  const expires_at = pickNonEmptyString(data, "expires_at");
  const mode = pickString(data, "mode");

  if (!session_id || !sandbox_id || !cwd || timeout_seconds === undefined || !created_at || !last_used_at || !expires_at || mode !== "command_stream") {
    throw new Error("Invalid terminal session response");
  }

  return {
    session_id,
    sandbox_id,
    cwd,
    timeout_seconds,
    created_at,
    last_used_at,
    expires_at,
    mode: "command_stream",
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    const data = asRecord(payload);
    const message = pickNonEmptyString(data, "message");
    if (message) {
      return message;
    }
  } catch {
    // Ignore JSON parse failures and use fallback.
  }

  return `HTTP ${response.status}`;
}

function parseStreamFrame(value: unknown): TerminalExecStreamFrame {
  const row = asRecord(value);
  if (!row) {
    throw new Error("Invalid terminal stream frame");
  }

  const type = pickString(row, "type");
  if (type === "stdout" || type === "stderr") {
    const data = pickString(row, "data");
    if (data === undefined) {
      throw new Error("Invalid terminal stream frame");
    }

    return { type, data };
  }

  if (type === "error") {
    const message = pickNonEmptyString(row, "message");
    if (!message) {
      throw new Error("Invalid terminal stream frame");
    }

    return { type: "error", message };
  }

  if (type === "done") {
    const exit_code = pickNumber(row, "exit_code");
    const duration_ms = pickNumber(row, "duration_ms");
    const resolved_cwd = pickString(row, "resolved_cwd");
    if (exit_code === undefined || duration_ms === undefined || !resolved_cwd) {
      throw new Error("Invalid terminal stream frame");
    }

    return { type: "done", exit_code, duration_ms, resolved_cwd };
  }

  throw new Error("Invalid terminal stream frame");
}

function parseEventDataLines(block: string): string[] {
  const lines = block.split("\n");
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  return dataLines;
}

export function isTerminalSessionGoneStatus(status: number | undefined): boolean {
  return status === SESSION_EXPIRED_STATUS || status === SESSION_NOT_FOUND_STATUS;
}

export async function createTerminalSession(
  options: TerminalSessionRequestOptions,
  input: CreateTerminalSessionInput = {},
): Promise<TerminalSessionResponse> {
  const response = await fetch(
    `${options.apiBaseUrl}/v1/sandboxes/${encodeURIComponent(options.sandboxId)}/terminal/sessions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw createTerminalHttpError(await readErrorMessage(response), response.status);
  }

  return parseSessionResponse(await response.json());
}

export async function closeTerminalSession(options: TerminalSessionRequestOptions, sessionId: string): Promise<void> {
  const response = await fetch(
    `${options.apiBaseUrl}/v1/sandboxes/${encodeURIComponent(options.sandboxId)}/terminal/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${options.token}`,
      },
    },
  );

  if (!response.ok && !isTerminalSessionGoneStatus(response.status)) {
    throw createTerminalHttpError(await readErrorMessage(response), response.status);
  }
}

export async function execTerminalCommandStream(options: ExecTerminalCommandInput): Promise<TerminalExecDoneFrame> {
  const payload: {
    cmd: string;
    cwd?: string;
    timeout_seconds?: number;
  } = {
    cmd: options.cmd,
  };
  if (options.cwd) {
    payload.cwd = options.cwd;
  }
  if (options.timeout_seconds !== undefined) {
    payload.timeout_seconds = options.timeout_seconds;
  }

  const response = await fetch(
    `${options.apiBaseUrl}/v1/sandboxes/${encodeURIComponent(options.sandboxId)}/terminal/sessions/${encodeURIComponent(options.sessionId)}/exec`,
    {
      method: "POST",
      signal: options.signal,
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw createTerminalHttpError(await readErrorMessage(response), response.status);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Terminal stream is not available");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex !== -1) {
      const eventBlock = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      separatorIndex = buffer.indexOf("\n\n");

      if (!eventBlock.trim()) {
        continue;
      }

      const dataLines = parseEventDataLines(eventBlock);
      if (!dataLines.length) {
        continue;
      }

      const frame = parseStreamFrame(JSON.parse(dataLines.join("\n")) as unknown);
      if (frame.type === "stdout") {
        options.onStdout(frame.data);
        continue;
      }
      if (frame.type === "stderr") {
        options.onStderr(frame.data);
        continue;
      }
      if (frame.type === "error") {
        throw new Error(frame.message);
      }

      return frame;
    }
  }

  throw new Error("Terminal stream ended without a done frame");
}
