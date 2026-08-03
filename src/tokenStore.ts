// Where OAuth refresh tokens are persisted between launches.

export interface TokenStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

/** Non-persistent store — default for tests; fine for `BackendTokenProvider`. */
export class MemoryTokenStore implements TokenStore {
  private map = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
  async deleteItem(key: string): Promise<void> {
    this.map.delete(key);
  }
}

/** The shape of the `expo-secure-store` module (the bits we use). */
export interface SecureStoreModule {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/**
 * Adapt `expo-secure-store` (Keychain / Keystore) — the recommended production
 * store. Inject the module so the package does not hard-depend on Expo:
 *
 *   import * as SecureStore from "expo-secure-store";
 *   const store = new SecureTokenStore(SecureStore);
 */
export class SecureTokenStore implements TokenStore {
  private readonly secureStore: SecureStoreModule;
  constructor(secureStore: SecureStoreModule) {
    this.secureStore = secureStore;
  }
  getItem(key: string): Promise<string | null> {
    return this.secureStore.getItemAsync(key);
  }
  setItem(key: string, value: string): Promise<void> {
    return this.secureStore.setItemAsync(key, value);
  }
  deleteItem(key: string): Promise<void> {
    return this.secureStore.deleteItemAsync(key);
  }
}
