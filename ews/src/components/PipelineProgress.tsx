import { StyleSheet, View } from 'react-native';
import { Text } from './Text';

import { colors, createStyles, space } from '../theme';
import type { MeetingStatus } from '../types';

const STEPS: { status: MeetingStatus; label: string }[] = [
  { status: 'QUEUED', label: 'Queued' },
  { status: 'TRANSCRIBING', label: 'Transcribing the recording' },
  { status: 'ENRICHING', label: 'Finding action items, decisions and topics' },
  { status: 'SUMMARIZING', label: 'Writing the summary' },
  { status: 'INDEXING', label: 'Indexing for questions' },
  { status: 'READY', label: 'Ready to ask Syntix' },
];

/** Shows how far the server-side pipeline (transcribe → enrich → summarise → index) has got. */
export function PipelineProgress({ status }: { status: MeetingStatus }) {
  const current = STEPS.findIndex((step) => step.status === status);
  if (current < 0) return null;
  return (
    <View style={styles.box}>
      {STEPS.map((step, index) => {
        const done = index < current || status === 'READY';
        const active = index === current && status !== 'READY';
        return (
          <View key={step.status} style={styles.row}>
            <Text style={[styles.mark, done && { color: colors.success }, active && { color: colors.primary }]}>
              {done ? '✓' : active ? '●' : '○'}
            </Text>
            <Text style={[styles.label, active && { color: colors.text, fontWeight: '600' }]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = createStyles(() => StyleSheet.create({
  box: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mark: { width: 18, color: colors.muted, fontSize: 14 },
  label: { color: colors.muted, fontSize: 14 },
}));
