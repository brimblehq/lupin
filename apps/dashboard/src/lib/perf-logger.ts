const SERVER_FN_PATH = "/_serverFn/";
const FLUSH_DEBOUNCE_MS = 400;

type Entry = {
  fn: string;
  method: string;
  ms: number;
  status: number;
  kb: number;
  workspace: string | null;
};

let installed = false;
let bucket: Entry[] = [];
let flushTimer: number | null = null;

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("brimble:perf-log") === "1") return true;
  } catch {
    // ignore
  }
  return new URLSearchParams(window.location.search).has("perflog");
}

function getCurrentWorkspace(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("workspace");
  } catch {
    return null;
  }
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    const entries = bucket;
    bucket = [];
    if (entries.length === 0) return;

    const sorted = [...entries].sort((a, b) => b.ms - a.ms);
    const sum = entries.reduce((acc, e) => acc + e.ms, 0);
    const workspace = entries[0]?.workspace ?? "(personal)";
    const label = `[serverFn] ${entries.length} calls · sum ${sum.toFixed(0)}ms · workspace=${workspace}`;

     
    console.groupCollapsed(label);
    console.table(
      sorted.map((e) => ({
        fn: e.fn,
        ms: Math.round(e.ms),
        status: e.status,
        kb: e.kb,
        method: e.method,
      })),
    );
    console.groupEnd();
     
  }, FLUSH_DEBOUNCE_MS);
}

function colorFor(ms: number): string {
  if (ms < 200) return "color:#10b981";
  if (ms < 800) return "color:#f59e0b";
  return "color:#ef4444";
}

// TanStack Start encodes the serverFn id as base64({"file":"...","export":"foo_createServerFn_handler"}).
// Decode and strip the boilerplate suffix so logs read as `foo` instead of a base64 blob.
function prettyFnName(rawId: string): string {
  try {
    const decoded = atob(rawId.replace(/-/g, "+").replace(/_/g, "/"));
    const match = decoded.match(/"export"\s*:\s*"([^"]+)"/);
    if (match) {
      return match[1].replace(/_createServerFn_handler$/, "").replace(/ServerFn$/, "");
    }
  } catch {
    // ignore decode errors
  }
  return rawId.length > 20 ? `${rawId.slice(0, 12)}…` : rawId;
}

export function installServerFnPerfLogger() {
  if (installed) return;
  if (!isEnabled()) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;

    if (!url.includes(SERVER_FN_PATH)) {
      return originalFetch(input as RequestInfo | URL, init);
    }

    const start = performance.now();
    const method =
      (init?.method ?? (input instanceof Request ? input.method : "POST")).toUpperCase();
    const rawId = url.split(SERVER_FN_PATH)[1]?.split(/[/?]/)[0] ?? "?";
    const fn = prettyFnName(rawId);

    try {
      const res = await originalFetch(input as RequestInfo | URL, init);
      const ms = performance.now() - start;
      const lenHeader = res.headers.get("content-length");
      const kb = lenHeader ? Math.round(Number(lenHeader) / 102.4) / 10 : 0;

      bucket.push({ fn, method, ms, status: res.status, kb, workspace: getCurrentWorkspace() });
      scheduleFlush();

       
      console.log(
        `%c[serverFn] ${fn} %c${ms.toFixed(0)}ms %c· ${res.status}${kb ? ` · ${kb}kb` : ""}`,
        colorFor(ms),
        colorFor(ms),
        "color:#888",
      );

      return res;
    } catch (err) {
      const ms = performance.now() - start;
       
      console.warn(`[serverFn] ${fn} failed after ${ms.toFixed(0)}ms`, err);
      throw err;
    }
  };
}
