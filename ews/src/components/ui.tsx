import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDemoReason } from '../api/demo';
import { colors, createStyles, fonts, radius, radiusSm, shadow, space } from '../theme';
import type { MeetingStatus } from '../types';

/** Page with a status-bar-aware top bar (title, optional back button and right-hand action). */
export function Screen({
  title,
  onBack,
  right,
  children,
  bottomInset = true,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  bottomInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const demo = useDemoReason() !== null;
  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: bottomInset ? insets.bottom : 0 }]}>
      <View style={styles.topBar}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={22} color={colors.navy} />
          </Pressable>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {demo ? (
          <View style={styles.demoChip} accessibilityLabel="Showing demo data">
            <Text style={styles.demoChipText}>Demo data</Text>
          </View>
        ) : null}
        <View style={styles.right}>{right}</View>
      </View>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  const textColor = variant === 'primary' || variant === 'danger' ? colors.onPrimary : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: colors.primary },
        variant === 'danger' && { backgroundColor: colors.danger },
        variant === 'secondary' && { backgroundColor: colors.primarySoft },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        inactive && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

/** White rounded card with a soft shadow. A `borderColor` in `style` shows as an outline. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function ErrorBanner({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <Pressable onPress={onDismiss} style={styles.error} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.navy, borderColor: colors.navy }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.onPrimary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// A function, not a constant: the colours change with the theme.
const statusStyles = (): Record<MeetingStatus, { bg: string; fg: string; label: string }> => ({
  CREATED: { bg: colors.border, fg: colors.muted, label: 'Scheduled' },
  RECORDED: { bg: colors.primarySoft, fg: colors.primary, label: 'Recorded' },
  QUEUED: { bg: colors.warnSoft, fg: colors.warn, label: 'Queued' },
  TRANSCRIBING: { bg: colors.warnSoft, fg: colors.warn, label: 'Transcribing' },
  ENRICHING: { bg: colors.warnSoft, fg: colors.warn, label: 'Analysing' },
  SUMMARIZING: { bg: colors.warnSoft, fg: colors.warn, label: 'Summarising' },
  INDEXING: { bg: colors.warnSoft, fg: colors.warn, label: 'Indexing' },
  READY: { bg: colors.greenSoft, fg: colors.success, label: 'Ready' },
  FAILED: { bg: colors.pinkSoft, fg: colors.pink, label: 'Failed' },
});

export function StatusBadge({ status }: { status: MeetingStatus }) {
  const look = statusStyles()[status];
  return (
    <View style={[styles.badge, { backgroundColor: look.bg }]}>
      <Text style={[styles.badgeText, { color: look.fg }]}>{look.label}</Text>
    </View>
  );
}

/** Headings (#), bullets (-, *) and **bold** markers of the LLM's Markdown summary, as plain text. */
export function SimpleMarkdown({ text }: { text: string }) {
  return (
    <View>
      {text.split('\n').map((raw, index) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={index} style={{ height: space.sm }} />;
        const heading = /^#{1,6}\s+(.*)$/.exec(line);
        if (heading) {
          return (
            <Text key={index} style={styles.mdHeading}>
              {heading[1].replace(/\*\*/g, '')}
            </Text>
          );
        }
        const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
        if (bullet) {
          return (
            <Text key={index} style={styles.mdBullet}>
              {'•  '}
              {bullet[1].replace(/\*\*/g, '')}
            </Text>
          );
        }
        return (
          <Text key={index} style={styles.mdText}>
            {line.replace(/\*\*/g, '')}
          </Text>
        );
      })}
    </View>
  );
}

const styles = createStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: colors.text },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  demoChip: { backgroundColor: colors.warnSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  demoChipText: { color: colors.warn, fontSize: 11, fontWeight: '700' },
  button: {
    minHeight: 46,
    paddingHorizontal: space.lg + 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius + 4,
    padding: space.lg + 4,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: space.md,
    ...shadow,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: space.md },
  muted: { color: colors.muted, fontSize: 14 },
  error: { backgroundColor: colors.dangerSoft, padding: space.md, borderRadius: radiusSm, marginBottom: space.md },
  errorText: { color: colors.danger, fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: space.xs },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radiusSm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 16,
    color: colors.text,
    fontFamily: fonts.regular,
  },
  chip: {
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    maxWidth: 220,
  },
  chipText: { fontSize: 14, color: colors.text },
  badge: { paddingHorizontal: space.sm + 2, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  mdHeading: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: space.sm, marginBottom: space.xs },
  mdBullet: { fontSize: 15, color: colors.text, lineHeight: 22, paddingLeft: space.sm },
  mdText: { fontSize: 15, color: colors.text, lineHeight: 22 },
}));
