export type FieldOp = "eq" | "neq" | "contains" | "regex" | "gte" | "lte" | "gt" | "lt";

export interface FieldCondition {
  id: string;
  key: string;
  op: FieldOp;
  value: string;
}

export interface AppLogFilters {
  text?: string;
  fields?: FieldCondition[];
}

export const emptyAppLogFilters: AppLogFilters = {};

export const NUMERIC_OPS: FieldOp[] = ["gte", "lte", "gt", "lt"];

export const FIELD_OP_LABELS: Record<FieldOp, string> = {
  eq: "=",
  neq: "≠",
  contains: "contains",
  regex: "regex",
  gte: "≥",
  lte: "≤",
  gt: ">",
  lt: "<",
};

function escapeDouble(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

function opFragment(key: string, op: FieldOp, value: string): string {
  const k = key.trim();
  if (!k) return "";
  const v = value.trim();
  switch (op) {
    case "eq":
      return `| ${k}="${escapeDouble(v)}"`;
    case "neq":
      return `| ${k}!="${escapeDouble(v)}"`;
    case "contains":
      return `| ${k}=~"(?i).*${escapeDouble(v)}.*"`;
    case "regex":
      return `| ${k}=~"${escapeDouble(v)}"`;
    case "gte":
      return `| ${k}>=${Number(v)}`;
    case "lte":
      return `| ${k}<=${Number(v)}`;
    case "gt":
      return `| ${k}>${Number(v)}`;
    case "lt":
      return `| ${k}<${Number(v)}`;
  }
}

export function buildAppLogPipeline(f: AppLogFilters): string {
  const parts: string[] = [];

  const text = f.text?.trim();
  if (text) {
    parts.push(`|= "${escapeDouble(text)}"`);
  }

  const fields = (f.fields ?? []).filter((c) => c.key.trim() && (NUMERIC_OPS.includes(c.op) ? Number.isFinite(Number(c.value)) : c.value.trim().length > 0));

  if (fields.length > 0) parts.push("| json");

  for (const cond of fields) {
    const frag = opFragment(cond.key, cond.op, cond.value);
    if (frag) parts.push(frag);
  }

  return parts.join(" ");
}

export function hasAnyAppLogFilter(f: AppLogFilters): boolean {
  return buildAppLogPipeline(f).length > 0;
}

export function newFieldCondition(): FieldCondition {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key: "",
    op: "eq",
    value: "",
  };
}
