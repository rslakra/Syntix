import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '../components/Text';

import { BarChart } from '../components/charts';
import { Kpi, Panel, SampleChip } from '../components/panel';
import { Button, Chip, Screen } from '../components/ui';
import { SAMPLE_REPORTS, type SampleReport } from '../data/sample';
import { useDashboard } from '../hooks/useDashboard';
import { colors, createStyles, space } from '../theme';
import { notify } from '../utils/dialog';
import { meetingDate } from '../utils/stats';

const PERIODS = [
  { id: 'week', label: 'Week', days: 7 },
  { id: 'month', label: 'Month', days: 30 },
  { id: 'quarter', label: 'Quarter', days: 90 },
] as const;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Reports. The meeting counts come from the meeting list; hours, action items and decisions are
 * estimates, and the report list is sample data kept on this screen, until a reports API exists
 * (the Generate and Export buttons are where it plugs in).
 */
export function ReportsScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 1180;
  const { meetings, usingSample } = useDashboard();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('month');
  const [reports, setReports] = useState<SampleReport[]>(SAMPLE_REPORTS);
  const [open, setOpen] = useState<string | null>(null);

  const choice = PERIODS.find((p) => p.id === period) ?? PERIODS[1];
  const figures = useMemo(() => {
    const now = Date.now();
    const since = now - choice.days * 86_400_000;
    const inPeriod = meetings.filter((m) => {
      const time = meetingDate(m)?.getTime() ?? 0;
      return time >= since && time <= now;
    });
    const perDay = WEEKDAYS.map(() => 0);
    for (const meeting of inPeriod) {
      const day = meetingDate(meeting)?.getDay() ?? 0;
      perDay[(day + 6) % 7] += 1; // Monday first
    }
    const count = inPeriod.length;
    return {
      count,
      ready: inPeriod.filter((m) => m.status === 'READY').length,
      hours: Math.round(count * 0.8 * 10) / 10,
      actionItems: count * 3,
      decisions: count * 2,
      perDay,
    };
  }, [meetings, choice.days]);

  const generate = () => {
    const report: SampleReport = {
      id: `r-${Date.now()}`,
      title: `${choice.label}ly report`.replace('Weekly report', 'Weekly digest'),
      period: `Last ${choice.days} days`,
      meetings: figures.count,
      hours: figures.hours,
      actionItems: figures.actionItems,
      decisions: figures.decisions,
      topics: ['Budget', 'Launch', 'Hiring'],
    };
    setReports((current) => [report, ...current]);
    setOpen(report.id);
  };

  const left = (
    <>
      <View style={styles.kpis}>
        <Kpi value={String(figures.count)} label="Meetings" hint={`${figures.ready} ready`} tint={colors.primarySoft} />
        <Kpi value={String(figures.hours)} label="Hours recorded" hint="estimate" tint={colors.tealSoft} />
        <Kpi value={String(figures.actionItems)} label="Action items" hint="estimate" tint={colors.pinkSoft} />
        <Kpi value={String(figures.decisions)} label="Decisions" hint="estimate" tint={colors.greenSoft} />
      </View>
      <Panel
        title="Meetings by weekday"
        subtitle={`Last ${choice.days} days`}
        right={usingSample ? <SampleChip /> : undefined}
      >
        <BarChart labels={WEEKDAYS} values={figures.perDay} color={colors.primary} />
      </Panel>
    </>
  );

  const list = (
    <Panel title="Generated reports" subtitle="Kept on this device until the reports API exists" right={<SampleChip />}>
      <View style={{ gap: space.md }}>
        {reports.map((report) => {
          const expanded = open === report.id;
          return (
            <View key={report.id} style={styles.report}>
              <Pressable onPress={() => setOpen(expanded ? null : report.id)} style={styles.reportHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.muted}>
                    {report.period} · {report.meetings} meetings · {report.hours} h
                  </Text>
                </View>
                <Text style={styles.link}>{expanded ? 'Hide' : 'View'}</Text>
              </Pressable>
              {expanded ? (
                <View style={{ gap: space.md, marginTop: space.md }}>
                  <View style={styles.numbers}>
                    <Text style={styles.number}>{report.actionItems} action items</Text>
                    <Text style={styles.number}>{report.decisions} decisions</Text>
                  </View>
                  <View style={styles.topics}>
                    {report.topics.map((topic) => (
                      <View key={topic} style={styles.topic}>
                        <Text style={styles.topicText}>{topic}</Text>
                      </View>
                    ))}
                  </View>
                  <Button
                    title="Export"
                    variant="secondary"
                    onPress={() =>
                      notify('Export is not available yet', 'Exporting a report needs the reports API. For now it only exists on this device.')
                    }
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Panel>
  );

  return (
    <Screen title="Reports" bottomInset={false} right={<Button title="Generate report" onPress={generate} style={{ minHeight: 40 }} />}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: 20 }}>
        <View style={styles.periods}>
          {PERIODS.map((item) => (
            <Chip key={item.id} label={item.label} selected={period === item.id} onPress={() => setPeriod(item.id)} />
          ))}
        </View>
        <View style={wide ? styles.columns : { gap: 20 }}>
          <View style={wide ? { flex: 1.4, gap: 20, minWidth: 0 } : { gap: 20 }}>{left}</View>
          <View style={wide ? { flex: 1, minWidth: 0 } : undefined}>{list}</View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = createStyles(() =>
  StyleSheet.create({
    periods: { flexDirection: 'row', gap: space.sm },
    columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
    kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    report: { backgroundColor: colors.bg, borderRadius: 16, padding: space.md + 2 },
    reportHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    reportTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    muted: { fontSize: 13, color: colors.muted },
    link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
    numbers: { flexDirection: 'row', gap: space.lg },
    number: { fontSize: 14, color: colors.text, fontWeight: '600' },
    topics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    topic: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
    topicText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  }),
);
