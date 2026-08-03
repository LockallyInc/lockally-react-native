// OAuth 2.1 authorization-code + PKCE for a signed-in *user*.
//
// The browser step differs per app, so it is injected: `authorize` opens the
// system browser and returns the `code`. With Expo this is a few lines of
// `expo-auth-session` (see the README). Token exchange, refresh, and secure
// persistence are handled here.
//
// The Lockally server issues user tokens only for the inbox/agent surface today
// (`inboxes:read` / `inboxes:write`). For sending mail or contacts, use
// BackendTokenProvider instead.

import type { TokenProvider } from "./tokenProvider.ts";
import type { TokenStore } from "./tokenStore.ts";
import { MemoryTokenStore } from "./tokenStore.ts";

export interface OAuthConfig {
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  clientId: string;
  redirectUri: string;
  scopes?: string[];
}

/** Opens the browser for `url` and resolves the authorization `code`. */
export type Authorize = (url: string) => Promise<{ code: string; state?: string }>;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

const DEFAULTS = {
  authorizationEndpoint: "https://api.lockally.com/oauth/authorize",
  tokenEndpoint: "https://api.lockally.com/oauth/token",
  scopes: ["inboxes:read", "inboxes:write"],
};

export class OAuthPKCEProvider implements TokenProvider {
  private access?: string;
  private accessExpiry = 0;
  private readonly store: TokenStore;
  private readonly cfg: Required<OAuthConfig>;

  constructor(config: OAuthConfig, store: TokenStore = new MemoryTokenStore()) {
    this.store = store;
    this.cfg = {
      authorizationEndpoint: config.authorizationEndpoint ?? DEFAULTS.authorizationEndpoint,
      tokenEndpoint: config.tokenEndpoint ?? DEFAULTS.tokenEndpoint,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scopes: config.scopes ?? DEFAULTS.scopes,
    };
  }

  private get refreshKey(): string {
    return `lockally.oauth.refresh.${this.cfg.clientId}`;
  }

  /** Build the `/oauth/authorize` URL for a PKCE challenge. */
  authorizationUrl(challenge: string, state: string): string {
    const q = new URLSearchParams({
      response_type: "code",
      client_id: this.cfg.clientId,
      redirect_uri: this.cfg.redirectUri,
      scope: this.cfg.scopes.join(" "),
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return `${this.cfg.authorizationEndpoint}?${q.toString()}`;
  }

  /** Exchange an authorization code + verifier for tokens. */
  async exchange(code: string, verifier: string): Promise<void> {
    await this.postToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.cfg.redirectUri,
      client_id: this.cfg.clientId,
      code_verifier: verifier,
    });
  }

  async token(): Promise<string> {
    if (this.access && this.accessExpiry - Date.now() > 30_000) return this.access;
    const refresh = await this.store.getItem(this.refreshKey);
    if (refresh) {
      return this.postToken({
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_id: this.cfg.clientId,
      });
    }
    throw new Error("Not signed in — run the PKCE flow and call exchange() first.");
  }

  async signOut(): Promise<void> {
    this.access = undefined;
    this.accessExpiry = 0;
    await this.store.deleteItem(this.refreshKey);
  }

  private async postToken(fields: Record<string, string>): Promise<string> {
    const resp = await fetch(this.cfg.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
    if (!resp.ok) throw new Error(`Token endpoint returned ${resp.status}`);
    const parsed = (await resp.json()) as TokenResponse;
    if (!parsed.access_token) throw new Error("Token response missing 'access_token'");
    this.access = parsed.access_token;
    this.accessExpiry = Date.now() + (parsed.expires_in ?? 3600) * 1000;
    if (parsed.refresh_token) await this.store.setItem(this.refreshKey, parsed.refresh_token);
    return this.access;
  }
}
