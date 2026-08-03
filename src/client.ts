// Factory that wires the secure auth + ergonomics layer into the generated
// `lockally` typescript-fetch client. The returned Configuration carries:
//   • auth        — Authorization: Bearer from your TokenProvider (async)
//   • retries     — network/429/5xx with backoff + jitter, honoring Retry-After
//   • idempotency — a stable Idempotency-Key on mutating requests
//
// Pass it to any generated API, e.g. `new SendApi(createClient({ tokenProvider }))`.

import { Configuration, type ConfigurationParameters } from "lockally";
import type { TokenProvider } from "./tokenProvider.ts";
import { retryFetch, type RetryOptions } from "./retry.ts";

export interface CreateClientOptions {
  tokenProvider: TokenProvider;
  /** Defaults to https://api.lockally.com */
  basePath?: string;
  /** Retry/backoff/idempotency tuning. */
  retry?: RetryOptions;
  /** Extra generated-client parameters (headers, middleware, custom fetch base). */
  configuration?: ConfigurationParameters;
}

/**
 * Build a configured `Configuration` for the generated APIs.
 *
 * ```ts
 * import { SendApi } from "lockally";
 * import { createClient, BackendTokenProvider } from "@lockally/react-native";
 *
 * const cfg = createClient({
 *   tokenProvider: BackendTokenProvider.fromEndpoint("https://api.yourapp.com/lockally/token"),
 * });
 * await new SendApi(cfg).v1SendPost({ v1SendPostRequest: { from, to, templateId, variables } });
 * ```
 */
export function createClient(options: CreateClientOptions): Configuration {
  const { tokenProvider, basePath = "https://api.lockally.com", retry, configuration } = options;
  return new Configuration({
    basePath,
    // Generated client calls this per request; return a fresh token each time.
    accessToken: () => tokenProvider.token(),
    fetchApi: retryFetch({ ...retry }),
    ...configuration,
  });
}
