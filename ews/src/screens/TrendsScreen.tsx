import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '../components/Text';

import { BarChart, LineChart, ProgressBar } from '../components/charts';
import { Kpi, Legend, Panel, SampleChip } from '../components/panel';
import { Screen } from '../components/ui';
import { SAMPLE_TOPICS } from '../data/sample';
import { useDashboard } from '../hooks/useDashboard';
import { colors, createStyles, space } from '../theme';
import { computeStats, meetingDate, monthlySeries } from '../utils/stats';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

/**
 * Trends. The charts and figures come from the meeting list; the trending topics are sample data
 * until the API extracts topics across meetings (each meeting already has its own topics).
 */
export function TrendsScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 1180;
  const { meetings, usingSample } = useDashboard();

  const series = useMemo(() => monthlySeries(meetings), [meetings]);
  const stats = useMemo(() => computeStats(meetings), [meetings]);
  const busy = useMemo(() => {
    const perHour = HOURS.map(() => 0);
    const perDay = WEEKDAYS.map(() => 0);
    for (const meeting of meetings) {
      const date = meetingDate(meeting);
      if (!date) continue;
      const slot = HOURS.indexOf(date.getHours());
      if (slot >= 0) perHour[slot] += 1;
      perDay[(date.getDay() + 6) % 7] += 1;
    }
    const top = Math.max(...perDay);
    return { perHour, busiestDay: top > 0 ? WEEKDAYS[perDay.indexOf(top)] : '—' };
  }, [meetings]);

  const weeks = Math.max(1, series.total.length * 4.3);
  const perWeek = (series.total.reduce((sum, n) => sum + n, 0) / weeks).toFixed(1);

  const topics = (
    <Panel title="Trending topics" subtitle="Share of meetings that mention them" right={<SampleChip />}>
      <View style={{ gap: 18 }}>
        {SAMPLE_TOPICS.map((topic) => (
          <View key={topic.name} style={{ gap: 8 }}>
            <View style={styles.topicRow}>
              <Text style={styles.topicName}>{topic.name}</Text>
              <View style={styles.change}>
                <MaterialIcons
                  name={topic.change >= 0 ? 'arrow-upward' : 'arrow-downward'}
                  size={14}
                  color={topic.change >= 0 ? colors.green : colors.pink}
                />
                <Text style={[styles.changeText, { color: topic.change >= 0 ? colors.green : colors.pink }]}>
                  {Math.abs(topic.change)}%
                </Text>
              </View>
              <Text style={styles.share}>{topic.share}%</Text>
            </View>
            <ProgressBar value={topic.share} color={colors.primary} track={colors.primarySoft} />
          </View>
        ))}
      </View>
    </Panel>
  );

  return (
    <Screen title="Trends" bottomInset={false}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: 20 }}>
        <View style={styles.kpis}>
          <Kpi value={perWeek} label="Meetings per week" hint="last 12 months" tint={colors.primarySoft} />
          <Kpi value={busy.busiestDay} label="Busiest day" tint={colors.tealSoft} />
          <Kpi value={`${stats.readyPct}%`} label="Processed successfully" hint={`${stats.ready} of ${stats.total}`} tint={colors.greenSoft} />
        </View>

        <View style={wide ? styles.columns : { gap: 20 }}>
          <View style={wide ? { flex: 1.6, gap: 20, minWidth: 0 } : { gap: 20 }}>
            <Panel
              title="Meeting load"
              subtitle="Last 12 months"
              right={
                <View style={styles.legends}>
                  <Legend color={colors.pink} label="Meetings" />
                  <Legend color={colors.teal} label="Ready" />
                  {usingSample ? <SampleChip /> : null}
                </View>
              }
            >
              <LineChart
                labels={series.labels}
                unit="meetings"
                series={[
                  { name: 'Meetings', color: colors.pink, values: series.total },
                  { name: 'Ready', color: colors.teal, values: series.ready },
                ]}
              />
            </Panel>
            <Panel
              title="Busiest hours"
              subtitle="Meetings by start hour"
              right={usingSample ? <SampleChip /> : undefined}
            >
              <BarChart labels={HOURS.map((h) => `${h}`)} values={busy.perHour} color={colors.teal} />
            </Panel>
          </View>
          <View style={wide ? { flex: 1, minWidth: 0 } : undefined}>{topics}</View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = createStyles(() =>
  StyleSheet.create({
    kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
    legends: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    topicRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    topicName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
    change: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    changeText: { fontSize: 12, fontWeight: '700' },
    share: { width: 40, textAlign: 'right', fontSize: 14, fontWeight: '700', color: colors.text },
  }),
);
