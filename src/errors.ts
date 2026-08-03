// Typed error mapped from a non-2xx Lockally API response. The generated
// typescript-fetch client throws its own ResponseError; use LockallyApiError
// when you want structured fields in your own flows.

export interface LockallyApiErrorInit {
  status: number;
  code?: string;
  message?: string;
  requestId?: string;
  body?: unknown;
}

export class LockallyApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly body?: unknown;

  constructor(init: LockallyApiErrorInit) {
    super(init.message ?? `lockally: HTTP ${init.status}`);
    this.name = "LockallyApiError";
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.body = init.body;
  }

  /** True when the server signalled a transient condition. */
  get retryable(): boolean {
    return this.status === 429 || (this.status >= 500 && this.status <= 599);
  }

  /** Build from a fetch Response, reading its body best-effort. */
  static async fromResponse(resp: Response): Promise<LockallyApiError> {
    const requestId = resp.headers.get("x-request-id") ?? undefined;
    let body: unknown;
    let code: string | undefined;
    let message: string | undefined;
    try {
      const text = await resp.text();
      body = text;
      if (text && (resp.headers.get("content-type") ?? "").includes("json")) {
        const j = JSON.parse(text) as {
          error?: { code?: string; message?: string };
          code?: string;
          message?: string;
        };
        body = j;
        code = j.error?.code ?? j.code;
        message = j.error?.message ?? j.message;
      }
    } catch {
      /* non-JSON or already-consumed body: keep what we have */
    }
    return new LockallyApiError({ status: resp.status, code, message, requestId, body });
  }
}
