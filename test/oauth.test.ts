import { test } from "node:test";
import assert from "node:assert/strict";
import { OAuthPKCEProvider } from "../src/oauth.ts";
import { MemoryTokenStore } from "../src/tokenStore.ts";

test("authorizationUrl includes PKCE + config params", () => {
  const p = new OAuthPKCEProvider(
    { clientId: "app_1", redirectUri: "myapp://cb", scopes: ["inboxes:read"] },
    new MemoryTokenStore()
  );
  const url = new URL(p.authorizationUrl("CHALLENGE", "state123"));
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "app_1");
  assert.equal(url.searchParams.get("code_challenge"), "CHALLENGE");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("scope"), "inboxes:read");
  assert.equal(url.searchParams.get("state"), "state123");
});

test("token() without a session rejects", async () => {
  const p = new OAuthPKCEProvider({ clientId: "a", redirectUri: "x://cb" }, new MemoryTokenStore());
  await assert.rejects(() => p.token(), /Not signed in/);
});
