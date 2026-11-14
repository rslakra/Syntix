import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DemoReason } from '../api/demo';
import { Avatar } from '../components/CallControls';
import { Donut, LineChart, ProgressBar } from '../components/charts';
import { Legend, Panel, SampleChip } from '../components/panel';
import { Button } from '../components/ui';
import { useContacts } from '../hooks/useContacts';
import { useDashboard } from '../hooks/useDashboard';
import { colors, createStyles, shadow, space } from '../theme';
import type { Meeting } from '../types';
import { useNav } from '../utils/nav';
import { getDisplayName } from '../utils/profile';
import {
  computeStats,
  hourLabel,
  meetingDate,
  meetingsOnDay,
  monthlySeries,
  notifications,
  startOfDay,
  type Stats,
} from '../utils/stats';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** Two columns (cards left, pipeline and today's meetings right) from this window width on. */
const TWO_COLUMNS = 1180;
/** Accent colours of the timeline cards (a function: they change with the theme). */
const cardColors = () => [colors.primary, colors.teal, colors.pink];

/**
 * The home dashboard. Every number comes from the meeting list (GET /meetings); contacts have no API
 * yet and are sample data; and when the API is unreachable, or empty, sample meetings stand in.
 */
export function DashboardScreen() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { meetings, usingSample, reason, error, reload } = useDashboard();
  const [notesOpen, setNotesOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const wide = width >= TWO_COLUMNS;
  const pad = width >= 900 ? 24 : 16;
  const name = getDisplayName();
  const stats = useMemo(() => computeStats(meetings), [meetings]);
  const series = useMemo(() => monthlySeries(meetings), [meetings]);
  const notes = useMemo(() => notifications(meetings), [meetings]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: pad, paddingTop: insets.top + pad, gap: 20 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await reload();
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.avatarRing}>
          <Avatar name={name} size={44} />
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.welcome} numberOfLines={1}>
            Welcome Back, <Text style={styles.welcomeName}>{name}</Text> 👋
          </Text>
          <Text style={styles.welcomeSub}>Local meeting intelligence</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Button title={width < 520 ? 'New' : '+ New meeting'} onPress={() => nav.push({ name: 'schedule' })} style={{ minHeight: 42 }} />
        <RoundIcon icon="work-outline" label="Meetings" onPress={() => nav.setTab('meetings')} />
        <RoundIcon
          icon="notifications-none"
          label="Notifications"
          dot={notes.length > 0}
          onPress={() => setNotesOpen((open) => !open)}
        />
      </View>

      {usingSample || error ? (
        <View style={styles.notice}>
          <MaterialIcons name="info-outline" size={20} color={colors.warn} />
          <Text style={styles.noticeText}>{usingSample ? demoNotice(reason) : error}</Text>
          {reason === 'unreachable' || (!usingSample && error) ? (
            <Button title="Retry" variant="secondary" onPress={reload} style={{ minHeight: 36 }} />
          ) : null}
        </View>
      ) : null}

      {notesOpen ? (
        <Panel title="Notifications" subtitle="Recent processing results">
          {notes.length === 0 ? (
            <Text style={styles.muted}>Nothing new.</Text>
          ) : (
            notes.map((note) => (
              <Pressable
                key={note.id}
                style={styles.noteRow}
                onPress={() => nav.push({ name: 'meeting', id: note.meetingId })}
              >
                <MaterialIcons
                  name={note.kind === 'ready' ? 'check-circle' : 'error-outline'}
                  size={22}
                  color={note.kind === 'ready' ? colors.green : colors.pink}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noteText}>{note.text}</Text>
                  {note.at ? (
                    <Text style={styles.muted}>
                      {note.at.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
        </Panel>
      ) : null}

      <View style={wide ? styles.columns : { gap: 20 }}>
        <View style={wide ? { flex: 2.4, gap: 20, minWidth: 0 } : { gap: 20 }}>
          <ContactsPanel period={series.period} />
          <View style={wide || width >= 760 ? styles.row : { gap: 20 }}>
            <View style={{ flex: 1.3 }}>
              <PerformancePanel stats={stats} sample={usingSample} />
            </View>
            <View style={{ flex: 1 }}>
              <ResultsPanel stats={stats} sample={usingSample} />
            </View>
          </View>
          <Panel
            title="Statistics"
            subtitle={series.period}
            right={
              <View style={styles.legendRow}>
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
        </View>

        <View style={wide ? { flex: 1, gap: 20, minWidth: 320 } : { gap: 20 }}>
          <PipelinePanel stats={stats} sample={usingSample} />
          <TodayPanel meetings={meetings} />
        </View>
      </View>
    </ScrollView>
  );
}

// --- building blocks ----------------------------------------------------------------------------

function RoundIcon({
  icon,
  label,
  dot,
  onPress,
}: {
  icon: IconName;
  label: string;
  dot?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.roundIcon}>
      <MaterialIcons name={icon} size={22} color={colors.navy} />
      {dot ? <View style={styles.roundIconDot} /> : null}
    </Pressable>
  );
}

// --- cards --------------------------------------------------------------------------------------

function ContactsPanel({ period }: { period: string }) {
  const nav = useNav();
  const { contacts, hasSample } = useContacts();
  const [selected, setSelected] = useState<string | undefined>(contacts[3]?.id);
  return (
    <Panel
      title="Contacts"
      subtitle={period}
      right={
        <View style={styles.legendRow}>
          {hasSample ? <SampleChip /> : null}
          <Pressable onPress={() => nav.setTab('contacts')} accessibilityRole="button">
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>See all</Text>
          </Pressable>
        </View>
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
        {contacts.map((contact) => {
          const active = contact.id === selected;
          const initials = contact.name
            .split(' ')
            .map((part) => part[0])
            .join('');
          return (
            <Pressable key={contact.id} onPress={() => setSelected(contact.id)} style={styles.contact}>
              <View style={[styles.contactTile, { backgroundColor: contact.tint }, active && styles.contactTileActive]}>
                <Text style={styles.contactInitials}>{initials}</Text>
              </View>
              <Text style={[styles.contactName, active && { color: colors.pink, fontWeight: '600' }]}>{contact.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Panel>
  );
}

function PerformanceRow({
  icon,
  tint,
  iconColor,
  title,
  sub,
  value,
}: {
  icon: IconName;
  tint: string;
  iconColor: string;
  title: string;
  sub: string;
  value: string;
}) {
  return (
    <View style={styles.performanceRow}>
      <View style={[styles.performanceIcon, { backgroundColor: tint }]}>
        <MaterialIcons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.muted}>{sub}</Text>
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function PerformancePanel({ stats, sample }: { stats: Stats; sample: boolean }) {
  return (
    <Panel title="Performance" right={sample ? <SampleChip /> : undefined}>
      <PerformanceRow
        icon="trending-up"
        tint={colors.primary}
        iconColor="#ffffff"
        title="Meetings processed"
        sub={`${stats.ready} of ${stats.total} meetings`}
        value={`${stats.readyPct}%`}
      />
      <PerformanceRow
        icon="mic"
        tint={colors.tealSoft}
        iconColor={colors.teal}
        title="Recordings captured"
        sub={`${stats.captured} with a recording or transcript`}
        value={`${stats.capturedPct}%`}
      />
    </Panel>
  );
}

function ResultsPanel({ stats, sample }: { stats: Stats; sample: boolean }) {
  return (
    <Panel title="Results" right={sample ? <SampleChip /> : undefined}>
      <View style={styles.resultsBody}>
        <View style={{ gap: 12 }}>
          <Legend color={colors.primary} label="Ready" />
          <Legend color={colors.pink} label="Other" />
        </View>
        <Donut
          segments={[
            { value: stats.ready, color: colors.primary },
            { value: Math.max(0, stats.total - stats.ready), color: colors.pink },
          ]}
        >
          <Text style={styles.donutValue}>
            {stats.readyPct}
            <Text style={styles.donutUnit}>%</Text>
          </Text>
        </Donut>
      </View>
    </Panel>
  );
}

function PipelinePanel({ stats, sample }: { stats: Stats; sample: boolean }) {
  const bars = [
    { label: 'Recorded', pct: stats.capturedPct, color: colors.primary, track: colors.primarySoft },
    { label: 'Ready', pct: stats.readyPct, color: colors.green, track: colors.greenSoft },
    { label: 'Needs attention', pct: stats.failedPct, color: colors.pink, track: colors.pinkSoft },
  ];
  return (
    <Panel title="Pipeline" subtitle="Where your meetings are" right={sample ? <SampleChip /> : undefined}>
      <View style={{ gap: 18 }}>
        {bars.map((bar) => (
          <View key={bar.label} style={{ gap: 8 }}>
            <View style={styles.barLabels}>
              <Text style={styles.barLabel}>{bar.label}</Text>
              <Text style={styles.barValue}>{bar.pct}%</Text>
            </View>
            <ProgressBar value={bar.pct} color={bar.color} track={bar.track} />
          </View>
        ))}
      </View>
    </Panel>
  );
}

function TodayPanel({ meetings }: { meetings: Meeting[] }) {
  const nav = useNav();
  const today = startOfDay(new Date());
  const [day, setDay] = useState(today);

  const days = [-2, -1, 0, 1, 2].map((offset) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
  const items = meetingsOnDay(meetings, day);
  const isToday = day.getTime() === today.getTime();

  const groups: { hour: number; items: Meeting[] }[] = [];
  for (const meeting of items) {
    const hour = meetingDate(meeting)?.getHours() ?? 0;
    const last = groups[groups.length - 1];
    if (last && last.hour === hour) last.items.push(meeting);
    else groups.push({ hour, items: [meeting] });
  }

  return (
    <Panel
      title={isToday ? 'Today, Meetings' : `${day.toLocaleDateString(undefined, { weekday: 'long' })}, Meetings`}
      right={
        <Pressable
          onPress={() => nav.push({ name: 'schedule' })}
          accessibilityRole="button"
          accessibilityLabel="Schedule a meeting"
          style={styles.addButton}
        >
          <MaterialIcons name="add" size={20} color={colors.primary} />
        </Pressable>
      }
    >
      <View style={styles.days}>
        {days.map((date) => {
          const selected = date.getTime() === day.getTime();
          const count = meetingsOnDay(meetings, date).length;
          return (
            <Pressable key={date.getTime()} onPress={() => setDay(date)} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View style={[styles.day, selected && { backgroundColor: colors.navy }]}>
                <Text style={[styles.dayNumber, selected && { color: '#ffffff' }]}>{String(date.getDate()).padStart(2, '0')}</Text>
                <Text style={[styles.dayName, selected && { color: '#c9c8e8' }]}>
                  {date.toLocaleDateString(undefined, { weekday: 'short' })}
                </Text>
              </View>
              <View style={styles.dots}>
                {Array.from({ length: Math.min(count, 3) }, (_, index) => (
                  <View key={index} style={[styles.dot, { backgroundColor: cardColors()[index % 3] }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.timeline}>
        {groups.length === 0 ? (
          <Text style={styles.muted}>No meetings on this day.</Text>
        ) : (
          groups.map((group) => (
            <View key={group.hour} style={{ gap: 8 }}>
              <Text style={styles.hour}>{hourLabel(group.hour)}</Text>
              {group.items.map((meeting, index) => (
                <Pressable
                  key={meeting.id}
                  onPress={() => nav.push({ name: 'meeting', id: meeting.id })}
                  style={[styles.meetingCard, { backgroundColor: cardColors()[(items.indexOf(meeting) + index) % 3] }]}
                >
                  <Text style={styles.meetingTitle} numberOfLines={1}>
                    {meeting.title}
                  </Text>
                  <Text style={styles.meetingText} numberOfLines={2}>
                    {meeting.description ?? statusText(meeting)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </View>
    </Panel>
  );
}

/** Why demo data is showing, in words. The demo meetings are fully usable, so say how to leave them. */
function demoNotice(reason: DemoReason): string {
  switch (reason) {
    case 'unreachable':
      return "Showing demo data because the Syntix API can't be reached. Everything works against demo data kept in the app; start the API to see yours.";
    case 'no-meetings':
      return 'Showing demo data: you have no meetings yet. Open a demo meeting to try the app; schedule or record your own and it takes over.';
    default:
      return 'Showing demo data, as selected in Settings → Data source.';
  }
}

function statusText(meeting: Meeting): string {
  switch (meeting.status) {
    case 'READY':
      return 'Ready: ask Syntix about it.';
    case 'FAILED':
      return 'Needs attention.';
    case 'CREATED':
      return 'Scheduled.';
    case 'RECORDED':
      return 'Recorded, waiting to be processed.';
    default:
      return 'Being processed…';
  }
}

const styles = createStyles(() => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatarRing: { padding: 3, borderRadius: 30, backgroundColor: colors.greenSoft },
  welcome: { fontSize: 18, color: colors.text },
  welcomeName: { fontWeight: '700' },
  welcomeSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  roundIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  roundIconDot: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.navy },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.warnSoft,
    borderRadius: 16,
    padding: space.md,
  },
  noticeText: { flex: 1, color: colors.warn, fontSize: 13 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  noteText: { color: colors.text, fontSize: 14 },

  columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  row: { flexDirection: 'row', gap: 20, alignItems: 'stretch' },

  panel: { backgroundColor: colors.card, borderRadius: 24, padding: 20, gap: 18, ...shadow },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  panelTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  panelSubtitle: { fontSize: 12, fontWeight: '600', color: colors.muted, marginTop: 4 },
  muted: { fontSize: 13, color: colors.muted },

  sampleChip: { backgroundColor: colors.warnSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  sampleChipText: { color: colors.warn, fontSize: 11, fontWeight: '700' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.text },

  contact: { alignItems: 'center', gap: 8 },
  contactTile: { width: 74, height: 74, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  contactTileActive: { borderColor: colors.pink },
  contactInitials: { fontSize: 24, fontWeight: '600', color: '#2b2a5a' },
  contactName: { fontSize: 13, color: colors.muted },

  performanceRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  performanceIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, color: colors.text },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.text },

  resultsBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg, flexWrap: 'wrap' },
  donutValue: { fontSize: 26, fontWeight: '700', color: colors.text },
  donutUnit: { fontSize: 15, color: colors.muted, fontWeight: '400' },

  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 13, color: colors.text, fontWeight: '600' },
  barValue: { fontSize: 13, color: colors.text, fontWeight: '600' },

  addButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  days: { flexDirection: 'row', gap: 8 },
  day: { width: '100%', borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', paddingVertical: 10 },
  dayNumber: { fontSize: 16, fontWeight: '600', color: colors.text },
  dayName: { fontSize: 12, color: colors.muted },
  dots: { flexDirection: 'row', gap: 3, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  timeline: { gap: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
  hour: { fontSize: 13, color: colors.muted },
  meetingCard: { borderRadius: 14, padding: 14, gap: 4 },
  meetingTitle: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  meetingText: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
}));
