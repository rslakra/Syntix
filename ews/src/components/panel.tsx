import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';

import { colors, createStyles, shadow } from '../theme';

/** White rounded card with a title, an optional subtitle and an optional right-hand slot. */
export function Panel({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Marks a card whose numbers are sample data because the API has nothing to offer yet. */
export function SampleChip({ label = 'Sample data' }: { label?: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

/** A big number with a caption, on its own soft card. */
export function Kpi({ value, label, hint, tint }: { value: string; label: string; hint?: string; tint: string }) {
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiBadge, { backgroundColor: tint }]} />
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = createStyles(() =>
  StyleSheet.create({
    panel: { backgroundColor: colors.card, borderRadius: 24, padding: 20, gap: 18, ...shadow },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 12, fontWeight: '600', color: colors.muted, marginTop: 4 },
    chip: { backgroundColor: colors.warnSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    chipText: { color: colors.warn, fontSize: 11, fontWeight: '700' },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12, color: colors.text },
    kpi: { flexGrow: 1, flexBasis: 150, backgroundColor: colors.card, borderRadius: 20, padding: 18, gap: 4, ...shadow },
    kpiBadge: { width: 36, height: 36, borderRadius: 18, marginBottom: 8 },
    kpiValue: { fontSize: 28, fontWeight: '700', color: colors.text },
    kpiLabel: { fontSize: 14, color: colors.text },
    kpiHint: { fontSize: 12, color: colors.muted },
  }),
);
