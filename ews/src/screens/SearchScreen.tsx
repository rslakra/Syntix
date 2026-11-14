import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../components/Text';

import { api, errorMessage } from '../api/client';
import { useDemoReason } from '../api/demo';
import { Card, Chip, ErrorBanner, Muted, Screen } from '../components/ui';
import { SEARCH_SUGGESTIONS } from '../data/sample';
import { colors, createStyles, fonts, shadow, space } from '../theme';
import { formatRange } from '../utils/format';
import { useNav } from '../utils/nav';

interface Hit {
  id: string;
  meetingId: string;
  title: string;
  start_ms: number | null;
  end_ms: number | null;
  text: string;
  score: number;
}

/** The text with the searched words marked. */
function Highlighted({ text, term }: { text: string; term: string }) {
  const words = term
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (words.length === 0) return <Text style={styles.excerpt}>{text}</Text>;
  const parts = text.split(new RegExp(`(${words.join('|')})`, 'gi'));
  return (
    <Text style={styles.excerpt}>
      {parts.map((part, index) =>
        words.some((word) => new RegExp(`^${word}$`, 'i').test(part)) ? (
          <Text key={index} style={styles.mark}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

/**
 * Semantic search across meetings (POST /search). With demo data on, the same call is answered by
 * the demo backend (keyword matches), and the results say so.
 */
export function SearchScreen() {
  const nav = useNav();
  const demo = useDemoReason() !== null;
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (text: string) => {
    const term = text.trim();
    if (!term) return;
    setQuery(term);
    setBusy(true);
    setError(null);
    try {
      const found = await api.search({ query: term });
      setHits(
        found.map((source) => ({
          id: source.chunk_id,
          meetingId: source.meeting_id,
          title: source.meeting_title,
          start_ms: source.start_ms,
          end_ms: source.end_ms,
          text: source.text,
          score: source.score,
        })),
      );
    } catch (e) {
      setHits([]);
      setError(errorMessage(e));
    } finally {
      setSearched(term);
      setBusy(false);
    }
  };

  return (
    <Screen title="Search" bottomInset={false}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
        <View style={styles.bar}>
          <MaterialIcons name="search" size={22} color={colors.muted} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => run(query)}
            placeholder="Search what was said in your meetings…"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {query ? (
            <Pressable
              onPress={() => {
                setQuery('');
                setHits(null);
                setSearched('');
              }}
              accessibilityLabel="Clear search"
            >
              <MaterialIcons name="close" size={20} color={colors.muted} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => run(query)} style={styles.go} accessibilityRole="button" accessibilityLabel="Search">
            <MaterialIcons name="arrow-forward" size={20} color="#ffffff" />
          </Pressable>
        </View>

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {hits === null ? (
          <Card>
            <Text style={styles.heading}>Try searching for</Text>
            <View style={styles.chips}>
              {SEARCH_SUGGESTIONS.map((suggestion) => (
                <Chip key={suggestion} label={suggestion} onPress={() => run(suggestion)} />
              ))}
            </View>
            <View style={{ marginTop: space.md }}>
              <Muted>Search understands meaning, not only exact words, and points to the moment it was said.</Muted>
            </View>
          </Card>
        ) : (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                {busy ? 'Searching…' : `${hits.length} result${hits.length === 1 ? '' : 's'} for "${searched}"`}
              </Text>
              {demo ? (
                <View style={styles.sampleChip}>
                  <Text style={styles.sampleChipText}>Demo data</Text>
                </View>
              ) : null}
            </View>
            {hits.length === 0 ? (
              <Card>
                <Muted>Nothing matched. Try a different word.</Muted>
              </Card>
            ) : null}
            {hits.map((hit) => (
              <Pressable key={hit.id} onPress={() => nav.push({ name: 'meeting', id: hit.meetingId })}>
                <Card>
                  <View style={styles.hitHead}>
                    <Text style={styles.hitTitle} numberOfLines={1}>
                      {hit.title}
                    </Text>
                    {hit.start_ms != null ? <Text style={styles.range}>{formatRange(hit.start_ms, hit.end_ms)}</Text> : null}
                    <View style={styles.score}>
                      <Text style={styles.scoreText}>{Math.round(hit.score * 100)}%</Text>
                    </View>
                  </View>
                  <Highlighted text={hit.text} term={searched} />
                </Card>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = createStyles(() =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      backgroundColor: colors.card,
      borderRadius: 999,
      paddingVertical: 6,
      paddingLeft: space.lg,
      paddingRight: 6,
      ...shadow,
    },
    input: { flex: 1, minWidth: 0, fontSize: 16, color: colors.text, paddingVertical: 8, fontFamily: fonts.regular },
    go: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    heading: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: space.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
    summaryText: { fontSize: 14, color: colors.muted },
    sampleChip: { backgroundColor: colors.warnSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    sampleChipText: { color: colors.warn, fontSize: 11, fontWeight: '700' },
    hitHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
    hitTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
    range: { fontSize: 12, color: colors.muted },
    score: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    scoreText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    excerpt: { fontSize: 15, lineHeight: 22, color: colors.text },
    mark: { backgroundColor: colors.primarySoft, color: colors.primary, fontWeight: '700' },
  }),
);
