import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'syntix.displayName';
const DEFAULT_NAME = 'You';

let displayName = DEFAULT_NAME;

/** The name shown on your tile in the lobby and in the call. Set in Settings. */
export function getDisplayName(): string {
  return displayName;
}

export async function loadDisplayName(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved?.trim()) displayName = saved.trim();
  } catch {
    // Storage unavailable: keep the default.
  }
  return displayName;
}

export async function saveDisplayName(name: string): Promise<void> {
  displayName = name.trim() || DEFAULT_NAME;
  await AsyncStorage.setItem(STORAGE_KEY, displayName);
}

/**
 * "Log out". There are no accounts yet, so this only forgets your name on this device; when sign-in
 * exists, end the session here.
 */
export async function signOut(): Promise<void> {
  displayName = DEFAULT_NAME;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function initialOf(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}
