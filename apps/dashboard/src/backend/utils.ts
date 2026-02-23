import { BackendNotImplementedError } from "./errors";

export function notImplemented<T>(scope: string, methodName: string): Promise<T> {
  return Promise.reject(new BackendNotImplementedError(scope, methodName));
}
