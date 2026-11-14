import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { Text } from './Text';

import { api, errorMessage } from '../api/client';
import { formatRange } from '../utils/format';
import { colors, createStyles, fonts, radius, shadow, space } from '../theme';
import type { Source } from '../types';
import { ErrorBanner } from './ui';

interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  sources?: Source[] | null;
}

const SUGGESTIONS = [
  'What decisions were made?',
  'List the action items and who owns them.',
  'Give me a short summary.',
];

/**
 * The Syntix chat: asks the API (retrieval-augmented, with cited sources) and keeps the thread
 * going through `conversation_id`. Remount it (change its `key`) to start a fresh thread.
 */
export function ChatPanel({
  meetingId,
  initialConversationId,
  onOpenMeeting,
}: {
  /** Limit answers to one meeting; omit to search all meetings. */
  meetingId?: string | null;
  /** Open an earlier thread. */
  initialConversationId?: string | null;
  onOpenMeeting?: (meetingId: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (!initialConversationId) return;
    let cancelled = false;
    api
      .getMessages(initialConversationId)
      .then((history) => {
        if (!cancelled) {
          setMessages(history.map((m) => ({ id: m.id, role: m.role, content: m.content, sources: m.sources })));
        }
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [initialConversationId]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      setInput('');
      setError(null);
      setBusy(true);
      setMessages((current) => [...current, { id: `local-${Date.now()}`, role: 'USER', content: question }]);
      try {
        const answer = await api.ask({
          question,
          meeting_id: meetingId ?? null,
          conversation_id: conversationId,
        });
        setConversationId(answer.conversation_id);
        setMessages((current) => [
          ...current,
          { id: answer.message_id, role: 'ASSISTANT', content: answer.answer, sources: answer.sources },
        ]);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, conversationId, meetingId],
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.intro}>
            <Text style={styles.introTitle}>Ask Syntix</Text>
            <Text style={styles.introText}>
              {meetingId
                ? 'Ask anything about this meeting. Answers cite the transcript.'
                : 'Ask anything about your processed meetings. Answers cite the transcript.'}
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
                <Pressable key={suggestion} style={styles.suggestion} onPress={() => send(suggestion)}>
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onOpenMeeting={onOpenMeeting} />
        ))}

        {busy ? (
          <View style={[styles.bubble, styles.assistant, styles.thinking]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.thinkingText}>Syntix is thinking…</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.composer}>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your meetings…"
            placeholderTextColor={colors.muted}
            multiline
            onSubmitEditing={() => send(input)}
            editable={!busy}
          />
          <Pressable
            style={[styles.send, (!input.trim() || busy) && { opacity: 0.4 }]}
            onPress={() => send(input)}
            disabled={!input.trim() || busy}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  message,
  onOpenMeeting,
}: {
  message: ChatMessage;
  onOpenMeeting?: (meetingId: string) => void;
}) {
  const [showSources, setShowSources] = useState(false);
  const mine = message.role === 'USER';
  const sources = message.sources ?? [];
  return (
    <View style={[styles.bubble, mine ? styles.user : styles.assistant]}>
      {!mine ? <Text style={styles.sender}>Syntix</Text> : null}
      <Text style={[styles.bubbleText, mine && { color: colors.onPrimary }]} selectable>
        {message.content}
      </Text>
      {sources.length > 0 ? (
        <View style={{ marginTop: space.sm }}>
          <Pressable onPress={() => setShowSources((v) => !v)}>
            <Text style={styles.sourcesToggle}>
              {showSources ? 'Hide' : 'Show'} {sources.length} source{sources.length === 1 ? '' : 's'}
            </Text>
          </Pressable>
          {showSources
            ? sources.map((source) => (
              <View key={`${source.chunk_id}-${source.index}`} style={styles.source}>
                <Pressable onPress={() => onOpenMeeting?.(source.meeting_id)} disabled={!onOpenMeeting}>
                  <Text style={styles.sourceTitle}>
                    [{source.index}] {source.meeting_title}
                    {source.start_ms != null ? `  ·  ${formatRange(source.start_ms, source.end_ms)}` : ''}
                  </Text>
                </Pressable>
                <Text style={styles.sourceText} numberOfLines={4}>
                  {source.text}
                </Text>
              </View>
            ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = createStyles(() => StyleSheet.create({
  list: { padding: space.lg, gap: space.md, flexGrow: 1 },
  intro: { alignItems: 'center', paddingVertical: space.xl, gap: space.sm },
  introTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  introText: { color: colors.muted, textAlign: 'center', fontSize: 14 },
  suggestions: { gap: space.sm, marginTop: space.md, alignSelf: 'stretch' },
  suggestion: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: space.md + 2,
    ...shadow,
  },
  suggestionText: { color: colors.primary, fontSize: 14 },
  bubble: { maxWidth: '88%', borderRadius: radius, padding: space.md },
  user: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  assistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    ...shadow,
  },
  sender: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: space.xs },
  bubbleText: { fontSize: 15, lineHeight: 22, color: colors.text },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  thinkingText: { color: colors.muted },
  sourcesToggle: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  source: { marginTop: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sourceTitle: { fontSize: 12, fontWeight: '700', color: colors.text },
  sourceText: { fontSize: 13, color: colors.muted, marginTop: 2 },
  composer: { padding: space.md, backgroundColor: colors.bg },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontSize: 16,
    color: colors.text,
    fontFamily: fonts.regular,
    ...shadow,
  },
  send: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: space.lg + 4, height: 46, justifyContent: 'center' },
  sendText: { color: colors.onPrimary, fontWeight: '700' },
}));
