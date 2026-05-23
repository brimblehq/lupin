export type ParsedActivityCommand =
  | { kind: "exec"; headline: string; command: string; cwd: string }
  | { kind: "destroyed"; headline: string; reason: string }
  | { kind: "other"; headline: string };

const EXEC_PATTERN = /^sandbox\.exec\s+cwd=(\S+)\s+cmd=(?:\(([\s\S]+?)\)|\{([\s\S]+?)\})\s*;\s*__brimble_status=/;
const DESTROY_PATTERN = /^sandbox\.destroyed(?:\s+reason=(\S+))?/;

/**
 * The activity feed wraps each exec in a probe script that captures the cwd
 * and exit code. For display we want the user-typed command on its own —
 * the parsed value is shown in the timeline, raw is available in the modal.
 *
 * Two wrapper shapes are emitted by the backend:
 *   cmd=(<cmd>\n)              — subshell form (parens)
 *   cmd={ <cmd>\n; }           — compound form (braces, requires trailing ;)
 */
export function parseActivityCommand(raw: string): ParsedActivityCommand {
  const execMatch = raw.match(EXEC_PATTERN);
  if (execMatch) {
    const cwd = execMatch[1];
    const inner = execMatch[2] ?? execMatch[3] ?? "";
    const command = inner.replace(/^\s+/, "").replace(/[\s;]+$/g, "");
    return { kind: "exec", headline: command, command, cwd };
  }

  const destroyMatch = raw.match(DESTROY_PATTERN);
  if (destroyMatch) {
    const reason = destroyMatch[1] ?? "unknown";
    return { kind: "destroyed", headline: `Destroyed (${humanizeReason(reason)})`, reason };
  }

  return { kind: "other", headline: raw };
}

function humanizeReason(reason: string): string {
  return reason.replace(/_/g, " ").toLowerCase();
}
