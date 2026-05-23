export interface TerminalSessionResponse {
  session_id: string;
  sandbox_id: string;
  cwd: string;
  timeout_seconds: number;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  mode: "command_stream";
}

export interface TerminalExecStdoutFrame {
  type: "stdout";
  data: string;
}

export interface TerminalExecStderrFrame {
  type: "stderr";
  data: string;
}

export interface TerminalExecDoneFrame {
  type: "done";
  exit_code: number;
  duration_ms: number;
  resolved_cwd: string;
}

export interface TerminalExecErrorFrame {
  type: "error";
  message: string;
}

export type TerminalExecStreamFrame =
  | TerminalExecStdoutFrame
  | TerminalExecStderrFrame
  | TerminalExecDoneFrame
  | TerminalExecErrorFrame;
