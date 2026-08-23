import { Platform } from 'react-native';

type Setter = (key: string, value: string) => Promise<void> | void;
type Getter = (key: string) => Promise<string | null> | string | null;

let webStorage: Storage | null = null;
let nativeGetItem: Getter | null = null;
let nativeSetItem: Setter | null = null;
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
    } catch {
      // AsyncStorage not available — getItem/setItem will return null/no-op
    }
    initDone = true;
  })();

  return initPromise;
}

export async function getItem(key: string): Promise<string | null> {
  if (!initDone && initPromise) {
    await initPromise;
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
  if (!initDone && initPromise) {
    await initPromise;
  }

  if (webStorage) {
    try {
      webStorage.setItem(key, value);
    } catch {
      // ignore
    }
    return;
  }
  if (nativeSetItem) {
    try {
      await nativeSetItem(key, value);
    } catch {
      // ignore
    }
  }
}
