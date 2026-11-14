import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';

import { api, errorMessage } from '../api/client';
import { ChatPanel } from '../components/ChatPanel';
import { Button, Chip, ErrorBanner, Muted, Screen } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { useNav } from '../utils/nav';
import { colors, createStyles, radius, space } from '../theme';
import type { Conversation, Meeting } from '../types';

/** The "Syntix" chat bot: ask across all meetings, or limit it to one. */
export function AskScreen() {
  const nav = useNav();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [scope, setScope] = useState<string | null>(null);
  const [thread, setThread] = useState<{ key: number; conversationId: string | null }>({
    key: 0,
    conversationId: null,
  });
  const [history, setHistory] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listMeetings()
      .then((list) => setMeetings(list.filter((m) => m.status === 'READY')))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const newChat = useCallback(() => {
    setThread((t) => ({ key: t.key + 1, conversationId: null }));
    setHistory(null);
  }, []);

  const chooseScope = (meetingId: string | null) => {
    setScope(meetingId);
    newChat();
  };

  const toggleHistory = async () => {
    if (history) return setHistory(null);
    try {
      setHistory(await api.listConversations(scope));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const openConversation = (conversation: Conversation) => {
    setScope(conversation.meeting_id);
    setThread((t) => ({ key: t.key + 1, conversationId: conversation.id }));
    setHistory(null);
  };

  return (
    <Screen
      title="Syntix"
      bottomInset={false}
      right={
        <>
          <Button title="History" variant="ghost" onPress={toggleHistory} />
          <Button title="New chat" variant="secondary" onPress={newChat} />
        </>
      }
    >
      <View style={{ paddingHorizontal: space.lg }}>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scope}>
          <Chip label="All meetings" selected={scope === null} onPress={() => chooseScope(null)} />
          {meetings.map((meeting) => (
            <Chip key={meeting.id} label={meeting.title} selected={scope === meeting.id} onPress={() => chooseScope(meeting.id)} />
          ))}
        </ScrollView>
        {meetings.length === 0 ? (
          <View style={{ paddingHorizontal: space.lg }}>
            <Muted>No processed meetings yet. Record or import one and process it, then ask questions here.</Muted>
          </View>
        ) : null}
      </View>

      {history ? (
        <ScrollView style={styles.history} contentContainerStyle={{ padding: space.lg }}>
          {history.length === 0 ? <Muted>No earlier conversations.</Muted> : null}
          {history.map((conversation) => (
            <Pressable key={conversation.id} style={styles.historyItem} onPress={() => openConversation(conversation)}>
              <Text style={styles.historyTitle} numberOfLines={2}>
                {conversation.title || 'Conversation'}
              </Text>
              <Muted>{formatDateTime(conversation.created_at)}</Muted>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <ChatPanel
          key={`${scope ?? 'all'}-${thread.key}`}
          meetingId={scope}
          initialConversationId={thread.conversationId}
          onOpenMeeting={(id) => nav.push({ name: 'meeting', id })}
        />
      )}
    </Screen>
  );
}

const styles = createStyles(() => StyleSheet.create({
  scope: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm },
  history: { flex: 1 },
  historyItem: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  historyTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
}));
