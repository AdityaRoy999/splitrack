import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import { firebaseApp } from './firebaseConfig';

const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
type Manifest = { version: string; count: number };
const storageKey = async (key: string) => `splittrack_auth_${await digestStringAsync(CryptoDigestAlgorithm.SHA256, key)}`;
const readManifest = async (key: string): Promise<Manifest | null> => {
  const value = await SecureStore.getItemAsync(key, options);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Manifest;
    return typeof parsed.version === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(parsed.version) && Number.isInteger(parsed.count) && parsed.count > 0 && parsed.count <= 100 ? parsed : null;
  } catch { return null; }
};
const clearParts = async (key: string, manifest: Manifest | null) => {
  if (manifest) await Promise.all(Array.from({ length: manifest.count }, (_, i) => SecureStore.deleteItemAsync(`${key}_${manifest.version}_${i}`, options)));
};

// Chunk persisted Firebase sessions so refresh tokens stay in encrypted storage
// without exceeding Keychain's per-value limit. Publish the manifest last.
const securePersistence = {
  async getItem(key: string) {
    const base = await storageKey(key), manifest = await readManifest(base);
    if (!manifest) return null;
    const parts = await Promise.all(Array.from({ length: manifest.count }, (_, i) => SecureStore.getItemAsync(`${base}_${manifest.version}_${i}`, options)));
    return parts.every(part => part !== null) ? parts.join('') : null;
  },
  async setItem(key: string, value: string) {
    const base = await storageKey(key), old = await readManifest(base);
    const characters = Array.from(value), parts: string[] = [];
    for (let i = 0; i < characters.length; i += 400) parts.push(characters.slice(i, i + 400).join(''));
    if (!parts.length) parts.push('');
    const manifest = { version: randomUUID(), count: parts.length };
    try {
      await Promise.all(parts.map((part, i) => SecureStore.setItemAsync(`${base}_${manifest.version}_${i}`, part, options)));
      await SecureStore.setItemAsync(base, JSON.stringify(manifest), options);
    } catch (error) {
      await clearParts(base, manifest);
      throw error;
    }
    await clearParts(base, old);
  },
  async removeItem(key: string) {
    const base = await storageKey(key), manifest = await readManifest(base);
    await SecureStore.deleteItemAsync(base, options);
    await clearParts(base, manifest);
  },
};

let auth: Auth | undefined;
export function getFirebaseAuth() {
  if (!auth) {
    const app = firebaseApp();
    try { auth = initializeAuth(app, { persistence: getReactNativePersistence(securePersistence) }); }
    catch (error) {
      if ((error as { code?: string }).code !== 'auth/already-initialized') throw error;
      auth = getAuth(app);
    }
  }
  return auth;
}
