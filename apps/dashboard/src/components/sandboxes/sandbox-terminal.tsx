import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Terminal as XtermTerminal } from "@xterm/xterm";
import { ANSI, TERMINAL_KEYWORD_COLORS } from "@/lib/sandboxes/terminal-keywords";
import {
  closeTerminalSession,
  createTerminalSession,
  execTerminalCommandStream,
  isTerminalSessionGoneStatus,
} from "@/lib/sandboxes/terminal-session-client";
import type { TerminalSessionResponse } from "@/lib/sandboxes/terminal-session-types";
import type { SandboxResponse } from "@/backend/sandboxes";
import { getAccessTokenServerFn } from "@/server/auth/actions";
import { hapticToast as toast } from "@/utils/haptic-toast";
import config from "@/config";

interface SandboxTerminalProps {
  sandbox: SandboxResponse;
  isVisible?: boolean;
}

const KEY_CODE_BACKSPACE = 0x7f;
const KEY_CODE_ESCAPE = 0x1b;
const KEY_CODE_SPACE = 0x20;
const CTRL_C_SEQUENCE = "\x03";
const CLEAR_COMMAND = "clear";
const CURSOR_WIDTH = 4;
const ARROW_UP_SEQUENCE = "\x1b[A";
const ARROW_DOWN_SEQUENCE = "\x1b[B";
const ARROW_RIGHT_SEQUENCE = "\x1b[C";
const ARROW_LEFT_SEQUENCE = "\x1b[D";
const HOME_SEQUENCE = "\x1b[H";
const HOME_ALT_SEQUENCE = "\x1b[1~";
const END_SEQUENCE = "\x1b[F";
const END_ALT_SEQUENCE = "\x1b[4~";

const TERMINAL_THEME = {
  background: "#1a1c1e",
  foreground: "#e4e4e7",
  cursor: "#4879f8",
  cursorAccent: "#1a1c1e",
  selectionBackground: "rgba(72, 121, 248, 0.3)",
  black: "#1a1c1e",
  red: "#ef4444",
  green: "#13d282",
  yellow: "#f5a623",
  blue: "#4879f8",
  magenta: "#a855f7",
  cyan: "#5eead4",
  white: "#e4e4e7",
  brightBlack: "#646569",
  brightRed: "#ff7a7a",
  brightGreen: "#34e89e",
  brightYellow: "#ffc66b",
  brightBlue: "#7fb6ff",
  brightMagenta: "#c4b5fd",
  brightCyan: "#a7f3d0",
  brightWhite: "#fafafa",
} as const;

function getPrompt(cwd: string): string {
  return `\x1b[36mbrimble:${cwd}\x1b[0m $ `;
}

function writePrompt(term: XtermTerminal, cwd: string) {
  term.write(getPrompt(cwd));
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return fallbackMessage;
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Split a buffer into tokens and colorize the first command word. */
function colorizeLine(line: string): string {
  const parts = line.match(/\s+|\S+/g) ?? [];
  let foundCommand = false;
  let out = "";
  for (const part of parts) {
    if (!foundCommand && /\S/.test(part)) {
      foundCommand = true;
      const color = TERMINAL_KEYWORD_COLORS[part];
      out += color ? `${ANSI[color]}${part}${ANSI.reset}` : part;
    } else {
      out += part;
    }
  }
  return out;
}

interface FitController {
  fit: () => void;
}

export function SandboxTerminal({ sandbox, isVisible = true }: SandboxTerminalProps) {
  const getAccessToken = useServerFn(getAccessTokenServerFn);
  const getAccessTokenRef = useRef(getAccessToken);
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XtermTerminal | null>(null);
  const fitRef = useRef<FitController | null>(null);

  useEffect(() => {
    getAccessTokenRef.current = getAccessToken;
  }, [getAccessToken]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    requestAnimationFrame(() => {
      const term = termRef.current;
      const fit = fitRef.current;
      if (!term || !fit) {
        return;
      }

      try {
        fit.fit();
        term.refresh(0, term.rows - 1);
        term.focus();
      } catch {
        // ignore visibility-fit race
      }
    });
  }, [isVisible]);

  useEffect(() => {
    if (!hostRef.current) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/xterm/css/xterm.css"),
      ]);

      if (disposed || !hostRef.current) return;

      const term = new Terminal({
        theme: TERMINAL_THEME,
        fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace',
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: "block",
        cursorWidth: CURSOR_WIDTH,
        scrollback: 4000,
        allowTransparency: false,
        convertEol: true,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(hostRef.current);
      termRef.current = term;
      fitRef.current = fit;
      fit.fit();
      requestAnimationFrame(() => {
        try {
          fit.fit();
          term.refresh(0, term.rows - 1);
        } catch {
          // ignore delayed-fit race
        }
      });

      term.writeln(`\x1b[38;5;245m─── Brimble Sandbox · ${sandbox.name} (${sandbox.template})\x1b[0m`);
      term.writeln("");

      const sessionRef: { current: TerminalSessionResponse | null } = { current: null };
      let isRunning = false;
      let execAbortController: AbortController | null = null;
      let buffer = "";
      const history: string[] = [];
      let historyIndex = 0;
      let liveDraft = "";
      const commandQueue: string[] = [];
      let runningInputBuffer = "";
      let cursorIndex = 0;

      const getCurrentCwd = () => sessionRef.current?.cwd ?? "/";

      const resolveAccessToken = async () => {
        const token = await getAccessTokenRef.current({ data: undefined });
        if (!token) {
          throw new Error("Session expired. Please reload.");
        }

        return token;
      };

      const openSession = async (cwd?: string) => {
        const token = await resolveAccessToken();
        const nextSession = await createTerminalSession(
          {
            apiBaseUrl: config.apiUrl,
            sandboxId: sandbox.id,
            token,
          },
          cwd ? { cwd } : {},
        );
        sessionRef.current = nextSession;
        return nextSession;
      };

      const ensureSession = async () => {
        if (sessionRef.current) {
          return sessionRef.current;
        }

        return openSession();
      };

      const closeSession = async () => {
        const sessionId = sessionRef.current?.session_id;
        if (!sessionId) {
          return;
        }

        sessionRef.current = null;

        try {
          const token = await resolveAccessToken();
          await closeTerminalSession(
            {
              apiBaseUrl: config.apiUrl,
              sandboxId: sandbox.id,
              token,
            },
            sessionId,
          );
        } catch {
          // Session cleanup is best-effort.
        }
      };

      const renderLine = () => {
        term.write("\r\x1b[K");
        writePrompt(term, getCurrentCwd());
        term.write(colorizeLine(buffer));
        const charsToMoveLeft = buffer.length - cursorIndex;
        if (charsToMoveLeft > 0) {
          term.write(`\x1b[${charsToMoveLeft}D`);
        }
      };

      const replaceLine = (next: string) => {
        buffer = next;
        cursorIndex = next.length;
        renderLine();
      };

      const stabilizeCursorAfterPrompt = () => {
        requestAnimationFrame(() => {
          try {
            fit.fit();
            term.refresh(0, term.rows - 1);
            term.focus();
          } catch {
            // ignore delayed-fit race
          }
        });
      };

      const runCommand = async (command: string, retryOnSessionError: boolean) => {
        const session = await ensureSession();
        const token = await resolveAccessToken();

        try {
          const done = await execTerminalCommandStream({
            apiBaseUrl: config.apiUrl,
            sandboxId: sandbox.id,
            token,
            sessionId: session.session_id,
            cmd: command,
            signal: execAbortController?.signal,
            onStdout: (chunk) => term.write(chunk),
            onStderr: (chunk) => term.write(`\x1b[31m${chunk}\x1b[0m`),
          });

          sessionRef.current = {
            ...session,
            cwd: done.resolved_cwd,
            timeout_seconds: session.timeout_seconds,
            last_used_at: new Date().toISOString(),
          };
        } catch (error) {
          const status = getErrorStatus(error);
          if (retryOnSessionError && isTerminalSessionGoneStatus(status)) {
            const previousCwd = sessionRef.current?.cwd ?? "/";
            sessionRef.current = null;
            await openSession(previousCwd);
            await runCommand(command, false);
            return;
          }

          throw error;
        }
      };

      const executeUserCommand = async (command: string) => {
        isRunning = true;
        execAbortController = new AbortController();

        try {
          await runCommand(command, true);
        } catch (error) {
          if (!isAbortError(error)) {
            term.write(`\x1b[31m${getErrorMessage(error, "Command failed")}\x1b[0m\r\n`);
          }
        } finally {
          isRunning = false;
          execAbortController = null;
          if (runningInputBuffer.trim().length > 0) {
            commandQueue.push(runningInputBuffer);
            runningInputBuffer = "";
          }

          const next = commandQueue.shift();
          if (next !== undefined) {
            writePrompt(term, getCurrentCwd());
            term.write(`${colorizeLine(next)}\r\n`);
            void executeUserCommand(next);
          } else {
            writePrompt(term, getCurrentCwd());
          }
        }
      };

      const submitCommand = (command: string) => {
        if (command.length > 0 && history[history.length - 1] !== command) {
          history.push(command);
        }
        historyIndex = history.length;
        liveDraft = "";
        buffer = "";
        cursorIndex = 0;

        const trimmed = command.trim();
        if (trimmed.length === 0) {
          writePrompt(term, getCurrentCwd());
          return;
        }

        if (trimmed === CLEAR_COMMAND) {
          term.clear();
          writePrompt(term, getCurrentCwd());
          return;
        }

        if (isRunning) {
          commandQueue.push(command);
        } else {
          void executeUserCommand(command);
        }
      };

      try {
        const initialSession = await openSession();
        term.write(getPrompt(initialSession.cwd), () => {
          stabilizeCursorAfterPrompt();
        });
      } catch (error) {
        term.writeln(`\x1b[31m${getErrorMessage(error, "Failed to start terminal session")}\x1b[0m`);
        toast.error(getErrorMessage(error, "Failed to start terminal session"));
        term.write(getPrompt(getCurrentCwd()), () => {
          stabilizeCursorAfterPrompt();
        });
      }

      const onData = term.onData((data) => {
        if (data === CTRL_C_SEQUENCE) {
          if (isRunning) {
            commandQueue.length = 0;
            runningInputBuffer = "";
            execAbortController?.abort();
            term.write("^C\r\n");
            buffer = "";
            cursorIndex = 0;
            return;
          }

          if (buffer.length > 0) {
            buffer = "";
            cursorIndex = 0;
            term.write("^C\r\n");
            writePrompt(term, getCurrentCwd());
          }
          return;
        }

        // Arrow Up — walk back through history (only useful when not running)
        if (!isRunning && data === ARROW_UP_SEQUENCE) {
          if (history.length === 0) return;
          if (historyIndex === history.length) liveDraft = buffer;
          if (historyIndex > 0) {
            historyIndex -= 1;
            replaceLine(history[historyIndex]);
          }
          return;
        }
        // Arrow Down — walk forward (or restore live draft at the tail)
        if (!isRunning && data === ARROW_DOWN_SEQUENCE) {
          if (historyIndex < history.length - 1) {
            historyIndex += 1;
            replaceLine(history[historyIndex]);
          } else if (historyIndex === history.length - 1) {
            historyIndex = history.length;
            replaceLine(liveDraft);
            liveDraft = "";
          }
          return;
        }
        if (!isRunning && data === ARROW_LEFT_SEQUENCE) {
          if (cursorIndex > 0) {
            cursorIndex -= 1;
            term.write(ARROW_LEFT_SEQUENCE);
          }
          return;
        }
        if (!isRunning && data === ARROW_RIGHT_SEQUENCE) {
          if (cursorIndex < buffer.length) {
            cursorIndex += 1;
            term.write(ARROW_RIGHT_SEQUENCE);
          }
          return;
        }
        if (!isRunning && (data === HOME_SEQUENCE || data === HOME_ALT_SEQUENCE)) {
          cursorIndex = 0;
          renderLine();
          return;
        }
        if (!isRunning && (data === END_SEQUENCE || data === END_ALT_SEQUENCE)) {
          cursorIndex = buffer.length;
          renderLine();
          return;
        }

        // Ignore other escape sequences for now
        if (data.charCodeAt(0) === KEY_CODE_ESCAPE) return;

        // Split on any line terminator so pasted multi-line input is handled correctly
        // (\n, \r, or \r\n depending on the source).
        const segments = data.split(/\r\n|\n|\r/);
        const hasNewline = segments.length > 1;

        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          const isLast = i === segments.length - 1;

          for (const char of segment) {
            const code = char.charCodeAt(0);
            if (isRunning) {
              if (code === KEY_CODE_BACKSPACE) {
                if (runningInputBuffer.length > 0) {
                  runningInputBuffer = runningInputBuffer.slice(0, -1);
                }
              } else if (code >= KEY_CODE_SPACE) {
                runningInputBuffer += char;
              }
              continue;
            }

            if (code === KEY_CODE_BACKSPACE) {
              if (cursorIndex > 0) {
                buffer = `${buffer.slice(0, cursorIndex - 1)}${buffer.slice(cursorIndex)}`;
                cursorIndex -= 1;
                renderLine();
              }
            } else if (code >= KEY_CODE_SPACE) {
              buffer = `${buffer.slice(0, cursorIndex)}${char}${buffer.slice(cursorIndex)}`;
              cursorIndex += 1;
              renderLine();
            }
            // other control chars are ignored
          }

          if (!isLast) {
            // Hit a line terminator after this segment.
            if (isRunning) {
              if (runningInputBuffer.trim().length > 0) {
                commandQueue.push(runningInputBuffer);
              }
              runningInputBuffer = "";
            } else {
              term.write("\r\n");
              submitCommand(buffer);
            }
          } else if (hasNewline && isRunning && runningInputBuffer.trim().length > 0) {
            // Final segment of a multi-line paste that started while a command was running.
            commandQueue.push(runningInputBuffer);
            runningInputBuffer = "";
          }
        }
      });

      const resizeObserver = new ResizeObserver(() => {
        try {
          fit.fit();
        } catch {
          // ignore resize race
        }
      });
      resizeObserver.observe(hostRef.current);

      cleanup = () => {
        execAbortController?.abort();
        void closeSession();
        onData.dispose();
        resizeObserver.disconnect();
        termRef.current = null;
        fitRef.current = null;
        term.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [sandbox.id, sandbox.name, sandbox.template]);

  return (
    <div className="flex h-[min(70vh,640px)] min-h-[420px] flex-col overflow-hidden rounded-[4px] border-[0.5px] border-dash-border bg-[#1a1c1e]">
      <div className="flex-1 min-h-0 p-3">
        <div ref={hostRef} className="h-full w-full" />
      </div>
    </div>
  );
}
