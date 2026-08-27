import { Platform } from 'react-native';

type Setter = (key: string, value: string) => Promise<void> | void;
type Getter = (key: string) => Promise<string | null> | string | null;
type Remover = (key: string) => Promise<void> | void;
type AllKeysGetter = () => Promise<readonly string[]> | readonly string[];

let webStorage: Storage | null = null;
let nativeGetItem: Getter | null = null;
let nativeSetItem: Setter | null = null;
let nativeRemoveItem: Remover | null = null;
let nativeGetAllKeys: AllKeysGetter | null = null;
let initPromise: Promise<void> | null = null;
let initDone = false;

export function initStorage(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        webStorage = window.localStorage;
      }
      initDone = true;
      return;
    }

    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      nativeGetItem = (key: string) => AsyncStorage.getItem(key);
      nativeSetItem = (key: string, value: string) => AsyncStorage.setItem(key, value);
      nativeRemoveItem = (key: string) => AsyncStorage.removeItem(key);
      nativeGetAllKeys = () => AsyncStorage.getAllKeys();
    } catch {
      // AsyncStorage not available — getItem/setItem will return null/no-op
    }
    initDone = true;
  })();

  return initPromise;
}

export async function getItem(key: string): Promise<string | null> {
  if (!initDone) {
    await initStorage();
  }

  if (webStorage) {
    try {
      return webStorage.getItem(key);
    } catch {
      return null;
    }
  }
  if (nativeGetItem) {
    try {
      return await nativeGetItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (!initDone) {
    await initStorage();
  }

  if (webStorage) {
    try {
      webStorage.setItem(key, value);
    } catch {
      try {
        evictOldestCacheEntries();
        webStorage.setItem(key, value);
      } catch {
        // storage full even after eviction — give up silently
      }
    }
    return;
  }
  if (nativeSetItem) {
    try {
      await nativeSetItem(key, value);
    } catch {
      try {
        await evictOldestCacheEntriesNative();
        await nativeSetItem(key, value);
      } catch {
        // storage full even after eviction — give up silently
      }
    }
  }
}

function evictOldestCacheEntries(): void {
  if (webStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < webStorage.length; i++) {
      const k = webStorage.key(i);
      if (k && k.startsWith('cache:')) keysToRemove.push(k);
    }
    for (const k of keysToRemove) {
      try { webStorage.removeItem(k); } catch {}
    }
  }
}

async function evictOldestCacheEntriesNative(): Promise<void> {
  if (!nativeGetAllKeys || !nativeRemoveItem) return;
  try {
    const allKeys = await nativeGetAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith('cache:'));
    for (const k of cacheKeys) {
      try { await nativeRemoveItem(k); } catch {}
    }
  } catch {}
}
