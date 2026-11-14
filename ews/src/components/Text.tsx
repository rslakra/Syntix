import { StyleSheet, Text as NativeText, type TextProps } from 'react-native';

import { fonts } from '../theme';

/** On phones each weight of a custom font is its own family, so `fontWeight` picks the family. */
function familyFor(weight: unknown): string {
  const value = String(weight ?? '400');
  const number = Number(value);
  if (value === 'bold' || number >= 700) return fonts.bold;
  if (number >= 600) return fonts.semibold;
  if (number >= 500) return fonts.medium;
  return fonts.regular;
}

/** Drop-in replacement for react-native's Text that uses the app's typeface (Cabin). */
export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  return (
    <NativeText
      {...props}
      style={[style, { fontFamily: flat.fontFamily ?? familyFor(flat.fontWeight), fontWeight: 'normal' }]}
    />
  );
}
