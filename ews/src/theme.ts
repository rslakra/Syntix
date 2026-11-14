import type { ViewStyle } from 'react-native';

// Palette of the dashboard design: a soft lavender surface, white cards, an indigo primary,
// and navy / pink / teal accents. The dark palette keeps the same roles.
const lightPalette = {
  frame: '#bccde6', // the backdrop around the app panel on wide screens
  bg: '#f1f3fd',
  card: '#ffffff',
  text: '#24264b',
  muted: '#8a8fab',
  border: '#e8eaf6',

  primary: '#4b3fe4',
  primarySoft: '#ecebff',
  onPrimary: '#ffffff',
  navy: '#2b2a5a',

  pink: '#d4477b',
  pinkSoft: '#fbe4ed',
  teal: '#2c6b7e',
  tealSoft: '#e0f0f4',
  green: '#47bf8a',
  greenSoft: '#dcf5ea',

  danger: '#d93a5f',
  dangerSoft: '#fde3ea',
  success: '#15803d',
  successSoft: '#dcfce7',
  warn: '#b45309',
  warnSoft: '#fef3c7',
};

export type Palette = typeof lightPalette;

const darkPalette: Palette = {
  frame: '#0a0b14',
  bg: '#14152a',
  card: '#1e2038',
  text: '#eceefe',
  muted: '#9a9fc0',
  border: '#2c2e50',

  primary: '#7a6ff5',
  primarySoft: '#2b2868',
  onPrimary: '#ffffff',
  navy: '#5147e6', // the selected sidebar item: it must stand out from the dark card

  pink: '#ee6c98',
  pinkSoft: '#3d2133',
  teal: '#55a9bf',
  tealSoft: '#1b3844',
  green: '#5bd6a0',
  greenSoft: '#173b2c',

  danger: '#f2627f',
  dangerSoft: '#44202c',
  success: '#4ade80',
  successSoft: '#173a29',
  warn: '#f6b04d',
  warnSoft: '#3d2f12',
};

export type ThemeMode = 'light' | 'dark';

/**
 * The colours in use. It is one object that `applyTheme` rewrites in place, so code that reads
 * `colors.text` at render time (or inside `createStyles`) always sees the current theme.
 */
export const colors: Palette = { ...lightPalette };

/** The soft card shadow (works on the web and, with the new architecture, on phones). */
export const shadow: ViewStyle = { boxShadow: '0 10px 30px rgba(75, 63, 228, 0.07)' };

let version = 0;
let applied: ThemeMode = 'light';

export function currentMode(): ThemeMode {
  return applied;
}

/** Switches the palette. Screens must re-render afterwards (the ThemeProvider remounts them). */
export function applyTheme(mode: ThemeMode): void {
  Object.assign(colors, mode === 'dark' ? darkPalette : lightPalette);
  Object.assign(shadow, {
    boxShadow: mode === 'dark' ? '0 10px 30px rgba(0, 0, 0, 0.38)' : '0 10px 30px rgba(75, 63, 228, 0.07)',
  });
  applied = mode;
  version += 1;
}

/**
 * Like `StyleSheet.create`, but the styles are rebuilt when the theme changes. Use it for every
 * stylesheet that reads `colors` or `shadow`: `const styles = createStyles(() => StyleSheet.create({...}))`.
 */
export function createStyles<T extends object>(factory: () => T): T {
  let built: T | null = null;
  let builtFor = -1;
  return new Proxy({} as T, {
    get(_target, key) {
      if (built === null || builtFor !== version) {
        built = factory();
        builtFor = version;
      }
      return (built as Record<PropertyKey, unknown>)[key];
    },
  });
}

/** Soft pastel tiles, used for contacts and avatars. */
export const pastels = ['#fde6cf', '#e8e1fb', '#d9f1fb', '#fbd9e6', '#d8f3e2', '#d9defb', '#d3f1f5'];

/** The Cabin typeface (loaded in App.tsx); weights are separate families on phones. */
export const fonts = {
  regular: 'Cabin_400Regular',
  medium: 'Cabin_500Medium',
  semibold: 'Cabin_600SemiBold',
  bold: 'Cabin_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = 20;
export const radiusSm = 14;
