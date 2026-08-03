// RFC 7636 Proof Key for Code Exchange (S256).
//
// Mobile apps are public OAuth clients (no secret), so PKCE is mandatory. If you
// use `expo-auth-session`, it generates its own PKCE pair — you rarely need this
// directly. It's provided for non-Expo setups and is what the unit tests cover.

export interface PKCEPair {
  verifier: string;
  challenge: string;
  method: "S256";
}

/** Base64url without padding. */
export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getRandomValues(len: number): Uint8Array {
  const out = new Uint8Array(len);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(out);
  throw new Error(
    "No secure RNG. On React Native, import 'react-native-get-random-values' at app entry."
  );
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.subtle?.digest) {
    const digest = await c.subtle.digest("SHA-256", data);
    return new Uint8Array(digest);
  }
  throw new Error(
    "No SubtleCrypto. On React Native, pass a `digest` (e.g. from 'expo-crypto') to generatePKCE()."
  );
}

/** The S256 challenge for a given verifier. */
export async function challengeForVerifier(
  verifier: string,
  digest: (input: string) => Promise<Uint8Array> = sha256
): Promise<string> {
  return base64UrlEncode(await digest(verifier));
}

/** Generate a fresh verifier + S256 challenge. */
export async function generatePKCE(
  digest: (input: string) => Promise<Uint8Array> = sha256
): Promise<PKCEPair> {
  const verifier = base64UrlEncode(getRandomValues(32));
  return { verifier, challenge: await challengeForVerifier(verifier, digest), method: "S256" };
}
