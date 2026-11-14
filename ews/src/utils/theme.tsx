import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, Fragment, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { applyTheme, currentMode, type ThemeMode } from '../theme';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'syntix.theme';
let preference: ThemePreference = 'system';

function resolve(pref: ThemePreference, system: 'light' | 'dark' | null | undefined): ThemeMode {
  return pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
}

/** Reads the saved choice and applies it, before the first screen renders (so there is no flash). */
export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') preference = saved;
  } catch {
    // Storage unavailable: follow the system.
  }
  applyTheme(resolve(preference, Appearance.getColorScheme()));
  return preference;
}

interface ThemeContextValue {
  preference: ThemePreference;
  mode: ThemeMode;
  setPreference: (next: ThemePreference) => void;
  /** Rebuilds every screen below (for example after the name changed). */
  reload: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Applies the palette and remounts everything below it when the theme changes, so every screen
 * rebuilds its styles. Put it inside the navigation provider to keep the navigation state.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPref] = useState<ThemePreference>(preference);
  const mode = resolve(pref, system);
  if (currentMode() !== mode) applyTheme(mode); // idempotent, and must happen before the children render

  const setPreference = useCallback((next: ThemePreference) => {
    preference = next;
    setPref(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const [epoch, setEpoch] = useState(0);
  const reload = useCallback(() => setEpoch((n) => n + 1), []);

  const value = useMemo(() => ({ preference: pref, mode, setPreference, reload }), [pref, mode, setPreference, reload]);
  return (
    <ThemeContext.Provider value={value}>
      <Fragment key={`${mode}-${epoch}`}>{children}</Fragment>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
