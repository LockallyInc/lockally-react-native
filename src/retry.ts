// Retrying fetch wrapper for the generated typescript-fetch client. Plug it in
// via the generated Configuration's `fetchApi`:
//
//   import { Configuration } from "lockally";
//   import { retryFetch } from "@lockally/ergonomics";
//   const cfg = new Configuration({ fetchApi: retryFetch(), accessToken: "..." });
//
// It retries transient failures (network errors, 429, 5xx) with exponential
// backoff + jitter, honors Retry-After (429/503), and injects a stable
// Idempotency-Key on mutating requests so a retried write is not applied twice.

export type FetchAPI = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface RetryOptions {
  /** Extra attempts after the first. Default 3. */
  maxRetries?: number;
  /** Initial backoff in ms. Default 200. */
  baseDelayMs?: number;
  /** Backoff cap in ms (also caps Retry-After). Default 20000. */
  maxDelayMs?: number;
  /** Inject an Idempotency-Key on mutating requests without one. Default true. */
  autoIdempotencyKey?: boolean;
  /** Underlying fetch. Default globalThis.fetch. */
  fetch?: FetchAPI;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export function retryFetch(options: RetryOptions = {}): FetchAPI {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelayMs ?? 200;
  const maxDelay = options.maxDelayMs ?? 20_000;
  const autoIdem = options.autoIdempotencyKey ?? true;
  const baseFetch: FetchAPI = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  return async function retryingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    if (autoIdem && MUTATING.has(method) && !headers.has("Idempotency-Key")) {
      headers.set("Idempotency-Key", crypto.randomUUID());
    }
    const finalInit: RequestInit = { ...init, headers };

    let attempt = 0;
    for (;;) {
      throwIfAborted(finalInit.signal);

      let resp: Response | undefined;
      let netErr: unknown;
      try {
        resp = await baseFetch(input, finalInit);
      } catch (e) {
        netErr = e;
      }

      const isTransient = netErr !== undefined || (resp !== undefined && RETRYABLE_STATUS.has(resp.status));
      if (!isTransient || attempt >= maxRetries) {
        if (netErr !== undefined) throw netErr;
        return resp as Response;
      }

      const waitMs = resp
        ? retryDelayMs(attempt, resp, baseDelay, maxDelay)
        : backoffMs(attempt, baseDelay, maxDelay);
      attempt++;
      await sleep(waitMs, finalInit.signal);
    }
  };
}

function retryDelayMs(attempt: number, resp: Response, base: number, max: number): number {
  const ra = parseRetryAfter(resp.headers.get("retry-after"));
  if (ra !== undefined) return Math.min(ra, max);
  return backoffMs(attempt, base, max);
}

/** Full jitter: random in [0, min(base * 2^attempt, max)]. */
function backoffMs(attempt: number, base: number, max: number): number {
  const exp = Math.min(base * 2 ** attempt, max);
  return Math.floor(Math.random() * (exp + 1));
}

/** Retry-After as delta-seconds or HTTP-date → milliseconds. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs) * 1000;
  const when = Date.parse(value);
  if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  return undefined;
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(abortError());
    }
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw abortError();
}

function abortError(): Error {
  if (typeof DOMException === "function") return new DOMException("The operation was aborted.", "AbortError");
  const e = new Error("The operation was aborted.");
  e.name = "AbortError";
  return e;
}
