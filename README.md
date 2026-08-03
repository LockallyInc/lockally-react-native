# Lockally for React Native

Official React Native SDK for the [Lockally](https://lockally.com) API. It wraps
the typed [`lockally`](https://www.npmjs.com/package/lockally) client with
secure-by-default auth (backend-minted tokens + OAuth 2.1 PKCE), automatic
retries, idempotency keys, and cursor pagination.

## Install

```bash
npm install @lockally/react-native
# Recommended companions for the OAuth/secure-storage helpers (Expo):
npx expo install expo-auth-session expo-secure-store expo-crypto
```

If you use PKCE directly (not via `expo-auth-session`), also import a secure RNG
polyfill once at your app entry:
```ts
import "react-native-get-random-values";
```

---

## 🔐 Security: never ship a live API key

A React Native bundle is distributed to devices — anything in it, including a
`lk_live_…` key, can be extracted. A leaked send-scoped key is an open spam relay
billed to you.

- **Sending mail (OTP, verification) + contact sync** → `BackendTokenProvider`.
  Keep the `lk_live_` key on **your** server; hand the app short-lived, scoped tokens.
- **A signed-in user reading their own mail** → `OAuthPKCEProvider`.
- **`StaticTokenProvider`** is for server-side/internal use only (warns on `lk_live_`).

---

## Quick start

```ts
import { SendApi } from "lockally";
import { createClient, BackendTokenProvider } from "@lockally/react-native";

const cfg = createClient({
  tokenProvider: BackendTokenProvider.fromEndpoint(
    "https://api.yourapp.com/lockally/token",
    { method: "POST", headers: { Authorization: `Bearer ${userSession}` } }
  ),
});
const send = new SendApi(cfg);
```

## Cookbook

### OTP email / user verification
Trigger from the app, but the token comes from your backend (scoped to
`messages:send`). A stable `Idempotency-Key` is attached automatically, so a
retry never double-sends the code:

```ts
await send.v1SendPost({
  v1SendPostRequest: {
    from: "no-reply@yourapp.com",
    to: [email],
    templateId: "otp-code",
    variables: { code: otp, ttl: "10" },
  },
});
```

### Contact syncing
```ts
import { ContactsApi } from "lockally";
import { collect } from "@lockally/react-native";

const contacts = new ContactsApi(cfg);
const all = await collect((cursor) =>
  contacts.v1ContactsGet({ cursor }).then((r) => ({ items: r.data ?? [], nextCursor: r.nextCursor }))
);
```

### Push + email workflows
Register the device's push token with your backend; it decides per event whether
to push, email (via Lockally), or both. The SDK drives the email leg.

### Inbox / agent (OAuth PKCE, with Expo)
```ts
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { OAuthPKCEProvider, SecureTokenStore } from "@lockally/react-native";

const redirectUri = AuthSession.makeRedirectUri({ scheme: "yourapp" });
const oauth = new OAuthPKCEProvider(
  { clientId: "your-client-id", redirectUri },
  new SecureTokenStore(SecureStore)
);

// expo-auth-session generates PKCE and runs the browser; then:
await oauth.exchange(result.params.code, request.codeVerifier);
const cfg = createClient({ tokenProvider: oauth });
```

## Errors

Non-2xx responses can be mapped to `LockallyApiError` (`status` / `code` /
`message` / `requestId`) for structured handling and support logging.

## License

MIT — see [LICENSE](./LICENSE).
