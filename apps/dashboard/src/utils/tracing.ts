/**
 * Tracing data model + helpers.
 *
 * NOTE: the tracing backend is not wired up yet. `generateSampleTraces` produces
 * deterministic placeholder data so the UI can be designed and reviewed. When the
 * backend ships, replace the sample generator with the real server function and
 * map its response onto these same types — the UI consumes nothing else.
 */

export type SpanStatus = "ok" | "error";

export interface TraceSpan {
  id: string;
  parentId: string | null;
  /** Operation name, e.g. "SELECT users" */
  name: string;
  /** Logical service the span belongs to, e.g. "db", "auth", "cache" */
  service: string;
  /** Offset in ms from the start of the trace */
  startMs: number;
  durationMs: number;
  status: SpanStatus;
  attributes: Record<string, string>;
}

export interface TraceSummary {
  id: string;
  method: string;
  endpoint: string;
  /** Entry-point service */
  service: string;
  /** Epoch ms when the trace started */
  startedAt: number;
  durationMs: number;
  /** HTTP status of the root request */
  status: number;
  spanCount: number;
}

export interface TraceDetail extends TraceSummary {
  spans: TraceSpan[];
}

/* ─────────────────────────────────────────────
   Presentation helpers
   ───────────────────────────────────────────── */

export function formatDuration(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

/** Depth-first flatten of a span tree, ordered by start time, carrying nesting depth. */
export function flattenSpans(spans: TraceSpan[]): Array<{ span: TraceSpan; depth: number }> {
  const childrenOf = new Map<string | null, TraceSpan[]>();
  for (const span of spans) {
    const list = childrenOf.get(span.parentId) ?? [];
    list.push(span);
    childrenOf.set(span.parentId, list);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.startMs - b.startMs);
  }

  const ordered: Array<{ span: TraceSpan; depth: number }> = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const span of childrenOf.get(parentId) ?? []) {
      ordered.push({ span, depth });
      walk(span.id, depth + 1);
    }
  };
  walk(null, 0);
  return ordered;
}

/* ─────────────────────────────────────────────
   Sample data (placeholder until the backend lands)
   ───────────────────────────────────────────── */

/** Deterministic 0..1 from an integer seed — keeps sample data stable across renders. */
function seeded(n: number): number {
  const x = Math.sin(n * 99_991) * 10_000;
  return x - Math.floor(x);
}

type SpanTemplate = { service: string; name: string; startFrac: number; durFrac: number; parent: number | null };

const TEMPLATES: Record<string, (root: string) => SpanTemplate[]> = {
  read: (root) => [
    { service: "api", name: root, startFrac: 0, durFrac: 1, parent: null },
    { service: "auth", name: "verifyToken", startFrac: 0.04, durFrac: 0.1, parent: 0 },
    { service: "db", name: "SELECT", startFrac: 0.18, durFrac: 0.46, parent: 0 },
    { service: "db", name: "acquire connection", startFrac: 0.18, durFrac: 0.07, parent: 2 },
    { service: "cache", name: "redis.get", startFrac: 0.7, durFrac: 0.08, parent: 0 },
  ],
  write: (root) => [
    { service: "api", name: root, startFrac: 0, durFrac: 1, parent: null },
    { service: "auth", name: "verifyToken", startFrac: 0.03, durFrac: 0.09, parent: 0 },
    { service: "db", name: "BEGIN", startFrac: 0.15, durFrac: 0.05, parent: 0 },
    { service: "db", name: "INSERT", startFrac: 0.22, durFrac: 0.4, parent: 0 },
    { service: "queue", name: "publish order.created", startFrac: 0.68, durFrac: 0.18, parent: 0 },
  ],
  external: (root) => [
    { service: "api", name: root, startFrac: 0, durFrac: 1, parent: null },
    { service: "auth", name: "verifyToken", startFrac: 0.03, durFrac: 0.08, parent: 0 },
    { service: "http", name: "POST payments-api", startFrac: 0.16, durFrac: 0.58, parent: 0 },
    { service: "db", name: "UPDATE", startFrac: 0.78, durFrac: 0.16, parent: 0 },
  ],
  health: (root) => [{ service: "api", name: root, startFrac: 0, durFrac: 1, parent: null }],
};

const ENDPOINTS: Array<{ method: string; path: string; profile: keyof typeof TEMPLATES }> = [
  { method: "GET", path: "/v1/users", profile: "read" },
  { method: "POST", path: "/v1/checkout", profile: "write" },
  { method: "GET", path: "/v1/orders", profile: "read" },
  { method: "GET", path: "/health", profile: "health" },
  { method: "POST", path: "/v1/payments", profile: "external" },
  { method: "GET", path: "/v1/products", profile: "read" },
  { method: "PATCH", path: "/v1/users/profile", profile: "write" },
  { method: "DELETE", path: "/v1/sessions", profile: "write" },
  { method: "GET", path: "/v1/search", profile: "external" },
  { method: "GET", path: "/v1/cart", profile: "read" },
];

function pickStatus(seed: number, profile: string, base: number): number {
  if (profile === "health") return 200;
  if (seed > 0.92) return 503;
  if (seed > 0.86) return 500;
  if (seed > 0.78) return 404;
  return base;
}

function attrsFor(service: string, method: string, path: string, status: number): Record<string, string> {
  switch (service) {
    case "api":
      return { "http.method": method, "http.route": path, "http.status_code": String(status) };
    case "auth":
      return { "auth.method": "jwt", "auth.user_id": "u_8f2a91", "auth.result": status >= 400 ? "deny" : "allow" };
    case "db":
      return {
        "db.system": "postgres",
        "db.statement": method === "GET" ? "SELECT * FROM …" : "INSERT INTO …",
        "db.rows_affected": "20",
      };
    case "cache":
      return { "cache.system": "redis", "cache.hit": "true", "cache.key": "user:8f2a91" };
    case "queue":
      return { "messaging.system": "rabbitmq", "messaging.destination": "order.created", "messaging.message_id": "m_4c19" };
    case "http":
      return {
        "http.url": "https://api.payments.co/v1/charge",
        "http.method": "POST",
        "http.status_code": String(status >= 500 ? 502 : 200),
      };
    default:
      return {};
  }
}

function buildSpans(profile: keyof typeof TEMPLATES, method: string, path: string, total: number, status: number): TraceSpan[] {
  const template = (TEMPLATES[profile] ?? TEMPLATES.read)(`${method} ${path}`);
  const errorIdx = status >= 500 ? template.length - 1 : -1;
  return template.map((t, idx) => ({
    id: `s${idx}`,
    parentId: t.parent === null ? null : `s${t.parent}`,
    name: t.name,
    service: t.service,
    startMs: Math.round(t.startFrac * total),
    durationMs: Math.max(1, Math.round(t.durFrac * total)),
    status: idx === errorIdx ? "error" : "ok",
    attributes: attrsFor(t.service, method, path, status),
  }));
}

/** Build a stable set of placeholder traces ending at `now` (epoch ms). */
export function generateSampleTraces(now: number, count = 22): TraceDetail[] {
  return Array.from({ length: count }, (_, i) => {
    const seed = seeded(i + 1);
    const ep = ENDPOINTS[i % ENDPOINTS.length];
    const base = ep.profile === "write" ? 201 : 200;
    const status = pickStatus(seed, ep.profile, base);
    const total = ep.profile === "health" ? Math.round(2 + seed * 8) : Math.round(60 + seed * 840);
    const spans = buildSpans(ep.profile, ep.method, ep.path, total, status);
    const startedAt = now - i * 37_000 - Math.round(seed * 15_000);
    return {
      id: `tr_${(i + 1).toString(16).padStart(4, "0")}${Math.round(seed * 9999)}`,
      method: ep.method,
      endpoint: ep.path,
      service: "api",
      startedAt,
      durationMs: total,
      status,
      spanCount: spans.length,
      spans,
    };
  });
}
