import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';

import { initialOf } from '../utils/profile';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/**
 * Round call button. `off` is the "muted / camera off" look (a red icon on a pink button, as in
 * video-call apps); `tone` picks the colours for a light or a dark surface.
 */
export function RoundButton({
  icon,
  label,
  onPress,
  off,
  danger,
  disabled,
  size = 56,
  wide,
  tone = 'dark',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  off?: boolean;
  danger?: boolean;
  disabled?: boolean;
  size?: number;
  wide?: boolean;
  tone?: 'light' | 'dark';
}) {
  const background = danger ? '#d93025' : off ? '#f8d7da' : tone === 'light' ? '#e3e8ee' : '#3c4043';
  const color = danger ? '#ffffff' : off ? '#8c1d18' : tone === 'light' ? '#1b1f2a' : '#ffffff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.round,
        { height: size, width: wide ? size * 1.45 : size, borderRadius: size / 2, backgroundColor: background },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.8 },
      ]}
    >
      <MaterialIcons name={icon} size={size * 0.45} color={color} />
    </Pressable>
  );
}

/** Ten bars that light up with the microphone level; nothing when it cannot be measured. */
export function LevelMeter({
  level,
  color = '#34a853',
  style,
}: {
  level: number | null;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  if (level === null) return null;
  const lit = Math.round(Math.min(1, level) * 10);
  return (
    <View style={[styles.meter, style]} accessibilityLabel={`Microphone level ${lit} of 10`}>
      {Array.from({ length: 10 }, (_, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            { height: 6 + index * 1.6 },
            { backgroundColor: index < lit ? color : 'rgba(255,255,255,0.28)' },
          ]}
        />
      ))}
    </View>
  );
}

export function Avatar({ name, size = 96 }: { name: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.45 }]}>{initialOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  round: { alignItems: 'center', justifyContent: 'center' },
  meter: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 24 },
  bar: { width: 4, borderRadius: 2 },
  avatar: { backgroundColor: '#3b8a7e', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontWeight: '500' },
});
