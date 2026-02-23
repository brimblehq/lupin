import type { ApiErrorShape } from "./types";

export class BackendNotImplementedError extends Error {
  constructor(scope: string, methodName: string) {
    super(`[backend boilerplate] ${scope}.${methodName} is not implemented yet.`);
    this.name = "BackendNotImplementedError";
  }
}

export class BackendApiError extends Error {
  code: string;
  details?: unknown;

  constructor(payload: ApiErrorShape) {
    super(payload.message);
    this.name = "BackendApiError";
    this.code = payload.code;
    this.details = payload.details;
  }
}
