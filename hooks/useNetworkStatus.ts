import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export type NetworkStatus = 'online' | 'offline' | 'unknown';

let currentStatus: NetworkStatus = 'unknown';
const listeners = new Set<(status: NetworkStatus) => void>();

function notify(status: NetworkStatus) {
  currentStatus = status;
  for (const cb of listeners) cb(status);
}

function init() {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined') {
      currentStatus = navigator.onLine ? 'online' : 'offline';
      window.addEventListener('online', () => notify('online'));
      window.addEventListener('offline', () => notify('offline'));
    }
  }
}

init();

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(currentStatus);

  useEffect(() => {
    listeners.add(setStatus);
    setStatus(currentStatus);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);

  return status;
}

export function isOnline(): boolean {
  return currentStatus === 'online';
}
