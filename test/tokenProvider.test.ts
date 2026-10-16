import { test } from "node:test";
import assert from "node:assert/strict";
import { StaticTokenProvider, BackendTokenProvider, parseGrant } from "../src/tokenProvider.ts";

test("StaticTokenProvider returns its value", async () => {
  assert.equal(await new StaticTokenProvider("lk_test_abc").token(), "lk_test_abc");
});

test("parseGrant handles expires_at and expires_in", () => {
  const a = parseGrant({ token: "t1", expires_at: "2099-01-01T00:00:00Z" });
  assert.equal(a.token, "t1");
  assert.ok(a.expiresAt > Date.now());
  const b = parseGrant({ token: "t2", expires_in: 300 });
  assert.ok(Math.abs(b.expiresAt - (Date.now() + 300_000)) < 2000);
});

test("parseGrant throws without a token", () => {
  assert.throws(() => parseGrant({ expires_in: 5 }));
});

test("BackendTokenProvider caches until near expiry", async () => {
  let calls = 0;
  const p = new BackendTokenProvider(async () => {
    calls++;
    return { token: `tok_${calls}`, expiresAt: Date.now() + 3_600_000 };
  });
  const a = await p.token();
  const b = await p.token();
  assert.equal(a, b);
  assert.equal(calls, 1, "second call should hit the cache");
});

test("BackendTokenProvider collapses concurrent refreshes", async () => {
  let calls = 0;
  const p = new BackendTokenProvider(async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 10));
    return { token: `tok_${calls}`, expiresAt: Date.now() + 3_600_000 };
  });
  const [a, b] = await Promise.all([p.token(), p.token()]);
  assert.equal(a, b);
  assert.equal(calls, 1, "concurrent callers share one in-flight fetch");
});
