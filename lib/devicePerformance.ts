import { Platform } from 'react-native';

export type DeviceTier = 'low' | 'mid' | 'high';

let cachedTier: DeviceTier | null = null;

function detectTier(): DeviceTier {
  if (cachedTier) return cachedTier;

  if (Platform.OS === 'web') {
    const nav = navigator as any;
    const mem = nav?.deviceMemory;
    const cores = nav?.hardwareConcurrency;

    if (mem && mem <= 2) { cachedTier = 'low'; return cachedTier; }
    if (cores && cores <= 4) { cachedTier = 'low'; return cachedTier; }
    if (mem && mem <= 4) { cachedTier = 'mid'; return cachedTier; }
    cachedTier = 'high';
    return cachedTier;
  }

  cachedTier = 'mid';
  return cachedTier;
}

export function getDeviceTier(): DeviceTier {
  return detectTier();
}

export function isLowEndDevice(): boolean {
  return detectTier() === 'low';
}

export function shouldUseHeavyShadows(): boolean {
  return detectTier() !== 'low';
}

export function shouldUseGlowEffects(): boolean {
  return detectTier() !== 'low';
}
