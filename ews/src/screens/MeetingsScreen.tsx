import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';

import { api, errorMessage } from '../api/client';
import { Button, Card, ErrorBanner, Muted, Screen, StatusBadge } from '../components/ui';
import { formatDateTime, parseServerDate } from '../utils/format';
import { useNav } from '../utils/nav';
import { colors, createStyles, space } from '../theme';
import { IN_PROGRESS, type Meeting } from '../types';

function whenLabel(meeting: Meeting): string {
  if (meeting.ended_at) return `Held ${formatDateTime(meeting.started_at ?? meeting.ended_at)}`;
  if (meeting.started_at) return `Started ${formatDateTime(meeting.started_at)}`;
  if (meeting.scheduled_at) {
    const upcoming = (parseServerDate(meeting.scheduled_at)?.getTime() ?? 0) > Date.now();
    return `${upcoming ? 'Upcoming' : 'Scheduled'} ${formatDateTime(meeting.scheduled_at)}`;
  }
  return `Created ${formatDateTime(meeting.created_at)}`;
}

function sortKey(meeting: Meeting): number {
  const date = meeting.started_at ?? meeting.scheduled_at ?? meeting.created_at;
  return parseServerDate(date)?.getTime() ?? 0;
}

export function MeetingsScreen() {
  const nav = useNav();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.listMeetings();
      setMeetings([...list].sort((a, b) => sortKey(b) - sortKey(a)));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep statuses fresh while something is being processed.
  const busy = meetings.some((m) => IN_PROGRESS.includes(m.status));
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [busy, load]);

  const startNow = useCallback(async () => {
    setStarting(true);
    try {
      const now = new Date();
      const meeting = await api.createMeeting({
        title: `Call ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      });
      nav.push({ name: 'call', id: meeting.id });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStarting(false);
    }
  }, [nav]);

  return (
    <Screen title="Meetings" bottomInset={false}>
      <View style={styles.actions}>
        <Button title="Join Meeting" onPress={startNow} loading={starting} style={{ flex: 1 }} />
        <Button title="Schedule" variant="secondary" onPress={() => nav.push({ name: 'schedule' })} style={{ flex: 1 }} />
      </View>
      <View style={{ paddingHorizontal: space.lg }}>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      </View>
      <FlatList
        data={meetings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={
          loading ? undefined : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No meetings yet</Text>
              <Muted>Start a call to record one now, or schedule a meeting for later.</Muted>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => nav.push({ name: 'meeting', id: item.id })}>
            <Card>
              <View style={styles.rowTop}>
                <Text style={styles.meetingTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <StatusBadge status={item.status} />
              </View>
              <Muted>{whenLabel(item)}</Muted>
              {item.status === 'FAILED' && item.error_message ? (
                <Text style={styles.failed} numberOfLines={2}>
                  {item.error_message}
                </Text>
              ) : null}
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = createStyles(() => StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.md },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md, marginBottom: space.xs },
  meetingTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text },
  failed: { color: colors.danger, fontSize: 13, marginTop: space.xs },
  empty: { alignItems: 'center', paddingVertical: 48, gap: space.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
}));
