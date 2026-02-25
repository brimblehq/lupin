export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" ? (value as JsonRecord) : undefined;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asStringOrNumber(value: unknown): string | number | undefined {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

export function pickString(
  record: JsonRecord | undefined,
  ...keys: string[]
): string | undefined {
  if (!record) return undefined;

  for (const key of keys) {
    const value = asString(record[key]);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

export function pickNonEmptyString(
  record: JsonRecord | undefined,
  ...keys: string[]
): string | undefined {
  if (!record) return undefined;

  for (const key of keys) {
    const value = asNonEmptyString(record[key]);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

export function pickBoolean(
  record: JsonRecord | undefined,
  ...keys: string[]
): boolean | undefined {
  if (!record) return undefined;

  for (const key of keys) {
    const value = asBoolean(record[key]);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

export function pickNumber(
  record: JsonRecord | undefined,
  ...keys: string[]
): number | undefined {
  if (!record) return undefined;

  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}
