import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DeviceKind } from './types';

/**
 * Syntix's own on / off switch for each device, kept on this device (Settings → Microphone and camera).
 * It is separate from the system or browser permission, which an app can ask for but never take back:
 * with a device switched off here, Syntix does not ask for it and does not use it, whatever the
 * system allows.
 */
const STORAGE_KEY = 'syntix.devices';

let prefs: Record<DeviceKind, boolean> = { microphone: true, camera: true };

export function isDeviceAllowed(kind: DeviceKind): boolean {
  return prefs[kind];
}

export function getDevicePrefs(): Record<DeviceKind, boolean> {
  return { ...prefs };
}

export async function loadDevicePrefs(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) prefs = { ...prefs, ...(JSON.parse(saved) as Partial<Record<DeviceKind, boolean>>) };
  } catch {
    // Storage unavailable or unreadable: both devices stay allowed.
  }
}

export async function setDevicePref(kind: DeviceKind, allowed: boolean): Promise<void> {
  prefs = { ...prefs, [kind]: allowed };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/** What the lobby says when a switched-off device is asked for. */
export const deviceOffMessage = (kind: DeviceKind) =>
  `${kind === 'microphone' ? 'Microphone' : 'Camera'} use is turned off. Turn it on in Settings → Microphone and camera.`;
