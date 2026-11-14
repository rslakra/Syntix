import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * Where the app gets its data:
 *  - auto: the live API, with demo data when it cannot be reached or has no meetings yet;
 *  - live: the live API only (errors and empty lists show as they are);
 *  - demo: always the demo data, even when the API is up.
 */
export type DataSource = 'auto' | 'live' | 'demo';

/** Why demo data is on screen, or null when the live API is in use. */
export type DemoReason = 'unreachable' | 'no-meetings' | 'forced' | null;

const STORAGE_KEY = 'syntix.dataSource';

let source: DataSource = 'auto';
let reason: DemoReason = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function getDataSource(): DataSource {
  return source;
}

export function getDemoReason(): DemoReason {
  return reason;
}

/** Set by the API router each time it chooses between the live API and the demo data. */
export function setDemoReason(next: DemoReason): void {
  if (next !== reason) {
    reason = next;
    notify();
  }
}

export async function loadDataSource(): Promise<DataSource> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'auto' || saved === 'live' || saved === 'demo') source = saved;
  } catch {
    // Storage unavailable: keep automatic.
  }
  return source;
}

export async function saveDataSource(next: DataSource): Promise<void> {
  source = next;
  reason = null;
  notify();
  await AsyncStorage.setItem(STORAGE_KEY, next);
}

/** Re-renders when demo data starts or stops being shown. */
export function useDemoReason(): DemoReason {
  return useSyncExternalStore(subscribe, getDemoReason, getDemoReason);
}
