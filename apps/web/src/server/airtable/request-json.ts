import axios from "axios";

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ECONNABORTED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENOTFOUND",
]);

interface AirtableRequestOptions {
  url: string;
  apiKey: string;
  logTag: string;
}

export interface AirtableRequestFailure {
  status?: number;
  body?: string;
  error?: unknown;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status);
}

function isRetryableErrorCode(code?: string): boolean {
  return Boolean(code && RETRYABLE_ERROR_CODES.has(code));
}

function stringifyBody(data: unknown): string {
  if (typeof data === "string") return data;

  try {
    return JSON.stringify(data);
  } catch {
    return "";
  }
}

export async function requestAirtableJson<T>(options: AirtableRequestOptions): Promise<{ data?: T; failure?: AirtableRequestFailure }> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await axios.get<T>(options.url, {
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          Accept: "application/json",
        },
        timeout: REQUEST_TIMEOUT_MS,
      });

      return { data: response.data };
    } catch (error) {
      if (!axios.isAxiosError(error)) {
        return { failure: { error } };
      }

      const status = error.response?.status;
      if (status) {
        if (isRetryableStatus(status) && attempt < MAX_ATTEMPTS) {
          console.warn(`[${options.logTag}] Airtable request failed with status ${status}; retrying (attempt ${attempt + 1}/${MAX_ATTEMPTS}).`);
          await delay(RETRY_DELAY_MS * attempt);
          continue;
        }

        return {
          failure: {
            status,
            body: stringifyBody(error.response?.data),
          },
        };
      }

      if (isRetryableErrorCode(error.code) && attempt < MAX_ATTEMPTS) {
        console.warn(`[${options.logTag}] Airtable request failed due to network error; retrying (attempt ${attempt + 1}/${MAX_ATTEMPTS}).`, error);
        await delay(RETRY_DELAY_MS * attempt);
        continue;
      }

      return { failure: { error } };
    }
  }

  return { failure: { error: new Error("Airtable request failed after retries") } };
}
