import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePKCE, challengeForVerifier, base64UrlEncode } from "../src/pkce.ts";

test("challenge matches RFC 7636 Appendix B vector", async () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(await challengeForVerifier(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("base64url has no + / or padding", () => {
  const enc = base64UrlEncode(new Uint8Array([251, 255, 191, 0, 1, 2, 3]));
  assert.ok(!/[+/=]/.test(enc));
});

test("generatePKCE produces a valid, verifiable pair", async () => {
  const p = await generatePKCE();
  assert.ok(p.verifier.length >= 43 && p.verifier.length <= 128);
  assert.equal(p.method, "S256");
  assert.equal(p.challenge, await challengeForVerifier(p.verifier));
});
