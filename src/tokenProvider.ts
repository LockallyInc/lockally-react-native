// Supplies the bearer credential for each request. Async so it can refresh an
// expiring OAuth token or fetch a fresh short-lived one from your backend.

export interface TokenProvider {
  token(): Promise<string>;
}

let warned = false;
function warnLiveKey(): void {
  if (warned) return;
  warned = true;
  console.warn(
    "[Lockally] A live API key (lk_live_…) was passed to StaticTokenProvider. " +
      "If this runs inside a shipped app, the key is extractable and can be abused. " +
      "Use BackendTokenProvider (backend-minted short-lived token) or OAuthPKCEProvider."
  );
}

/**
 * A fixed key. **Do not embed a `lk_live_*` key in a distributed app.** Fine for
 * server-side/internal use and for `lk_test_*` keys; warns otherwise.
 */
export class StaticTokenProvider implements TokenProvider {
  private readonly value: string;
  constructor(value: string) {
    this.value = value;
    if (value.startsWith("lk_live_")) warnLiveKey();
  }
  async token(): Promise<string> {
    return this.value;
  }
}

export interface Grant {
  token: string;
  /** Epoch ms when the token expires. */
  expiresAt: number;
}

/**
 * The recommended provider for send / OTP / verification / contacts.
 *
 * Calls **your** backend, which authenticates the session and returns a
 * short-lived, narrowly-scoped Lockally token. Cached until shortly before it
 * expires. The `lk_live_` key stays on your server.
 *
 * Your endpoint must return `{ "token": "...", "expires_at": "<RFC3339>" }` or
 * `{ "token": "...", "expires_in": <seconds> }`.
 */
export class BackendTokenProvider implements TokenProvider {
  private cached?: Grant;
  private inflight?: Promise<string>;
  private readonly fetchGrant: () => Promise<Grant>;
  private readonly skewMs: number;

  constructor(fetchGrant: () => Promise<Grant>, skewMs = 30_000) {
    this.fetchGrant = fetchGrant;
    this.skewMs = skewMs;
  }

  /** Convenience: hit a URL on your backend that returns the grant JSON. */
  static fromEndpoint(
    endpoint: string,
    init: RequestInit = { method: "POST" },
    skewMs = 30_000
  ): BackendTokenProvider {
    return new BackendTokenProvider(async () => {
      const resp = await fetch(endpoint, init);
      if (!resp.ok) throw new Error(`Backend token endpoint returned ${resp.status}`);
      return parseGrant(await resp.json());
    }, skewMs);
  }

  async token(): Promise<string> {
    if (this.cached && this.cached.expiresAt - Date.now() > this.skewMs) {
      return this.cached.token;
    }
    // Collapse concurrent refreshes into one request.
    if (!this.inflight) {
      this.inflight = this.fetchGrant()
        .then((g) => {
          this.cached = g;
          return g.token;
        })
        .finally(() => {
          this.inflight = undefined;
        });
    }
    return this.inflight;
  }
}

export function parseGrant(obj: unknown): Grant {
  const o = obj as Record<string, unknown>;
  if (typeof o?.token !== "string") throw new Error("Backend token response missing 'token'");
  if (typeof o.expires_at === "string") {
    const t = Date.parse(o.expires_at);
    if (!Number.isNaN(t)) return { token: o.token, expiresAt: t };
  }
  if (typeof o.expires_in === "number") {
    return { token: o.token, expiresAt: Date.now() + o.expires_in * 1000 };
  }
  // No expiry hint → short-lived, force periodic refresh.
  return { token: o.token, expiresAt: Date.now() + 60_000 };
}
