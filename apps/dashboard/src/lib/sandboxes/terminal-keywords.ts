export type TerminalColor =
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "brightBlack"
  | "brightRed"
  | "brightGreen"
  | "brightYellow"
  | "brightBlue"
  | "brightMagenta"
  | "brightCyan";

/**
 * ANSI escape codes for each named color. The numeric codes map to the xterm
 * theme's color slots, so colors here render with whatever palette the
 * SandboxTerminal theme defines (see TERMINAL_THEME).
 */
export const ANSI: Record<TerminalColor | "reset", string> = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  brightBlack: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
};

/**
 * Keyword → color map applied to the first word of every typed line.
 * Matching is case-sensitive (shell commands are case-sensitive).
 *
 * Adding new entries is a one-line change — keep it tasteful.
 */
export const TERMINAL_KEYWORD_COLORS: Record<string, TerminalColor> = {
  // File system
  ls: "blue",
  cd: "blue",
  pwd: "blue",
  mkdir: "blue",
  rmdir: "blue",
  rm: "red",
  cp: "blue",
  mv: "blue",
  cat: "blue",
  less: "blue",
  more: "blue",
  head: "blue",
  tail: "blue",
  touch: "blue",
  find: "blue",
  grep: "yellow",
  chmod: "yellow",
  chown: "yellow",
  ln: "blue",

  // Editors
  vim: "magenta",
  vi: "magenta",
  nano: "magenta",
  emacs: "magenta",

  // VCS
  git: "yellow",

  // Package managers
  npm: "red",
  pnpm: "red",
  yarn: "red",
  bun: "red",
  pip: "red",
  brew: "red",
  apt: "red",

  // Runtimes
  node: "green",
  python: "green",
  python3: "green",
  ruby: "green",
  go: "cyan",
  rustc: "yellow",
  cargo: "yellow",
  deno: "green",

  // Network
  curl: "cyan",
  wget: "cyan",
  ssh: "cyan",
  scp: "cyan",
  ping: "cyan",
  nc: "cyan",

  // Process & system
  ps: "brightCyan",
  kill: "red",
  top: "brightCyan",
  htop: "brightCyan",
  df: "brightCyan",
  du: "brightCyan",
  uname: "brightCyan",

  // Misc shell
  echo: "brightBlue",
  printf: "brightBlue",
  sudo: "red",
  exit: "brightBlack",
  clear: "brightBlack",
  history: "brightBlack",
  which: "brightBlack",
  whoami: "brightBlack",
  env: "brightBlack",
  export: "brightBlack",
};
