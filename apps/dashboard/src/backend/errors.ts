import type { ApiErrorShape } from "./types";

export class BackendNotImplementedError extends Error {
  constructor(scope: string, methodName: string) {
    super(`[backend boilerplate] ${scope}.${methodName} is not implemented yet.`);
    this.name = "BackendNotImplementedError";
  }
}

export class BackendApiError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(payload: ApiErrorShape & { status?: number }) {
    super(payload.message);
    this.name = "BackendApiError";
    this.code = payload.code;
    this.status = payload.status;
    this.details = payload.details;
  }

  get isForbidden() {
    return this.status === 403 || this.code === "HTTP_403";
  }
}
