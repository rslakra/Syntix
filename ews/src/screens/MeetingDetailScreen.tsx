import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';

import { api, errorMessage } from '../api/client';
import { ChatPanel } from '../components/ChatPanel';
import { PipelineProgress } from '../components/PipelineProgress';
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Muted,
  Screen,
  SectionTitle,
  SimpleMarkdown,
  StatusBadge,
} from '../components/ui';
import { confirm } from '../utils/dialog';
import { formatBytes, formatDateTime, formatDuration, formatRange } from '../utils/format';
import { useNav } from '../utils/nav';
import { colors, createStyles, shadow, space } from '../theme';
import {
  IN_PROGRESS,
  type Enrichment,
  type MeetingDetail,
  type Recording,
  type Summary,
  type Transcript,
} from '../types';

type DetailTab = 'overview' | 'transcript' | 'recordings' | 'ask';

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'recordings', label: 'Recordings' },
  { id: 'ask', label: 'Ask Syntix' },
];

export function MeetingDetailScreen({ meetingId }: { meetingId: string }) {
  const nav = useNav();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const loadResults = useCallback(async () => {
    try {
      const [recs, trans, sum, enr] = await Promise.all([
        api.listRecordings(meetingId),
        api.getTranscripts(meetingId),
        api.getSummary(meetingId),
        api.getEnrichment(meetingId),
      ]);
      setRecordings(recs);
      setTranscripts(trans);
      setSummary(sum);
      setEnrichment(enr);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [meetingId]);

  const loadMeeting = useCallback(async () => {
    try {
      setMeeting(await api.getMeeting(meetingId));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [meetingId]);

  useEffect(() => {
    loadMeeting();
    loadResults();
  }, [loadMeeting, loadResults]);

  // Poll while the server processes the meeting; refresh the results when it stops.
  const status = meeting?.status;
  const previous = useRef(status);
  useEffect(() => {
    const wasBusy = previous.current ? IN_PROGRESS.includes(previous.current) : false;
    if (wasBusy && status && !IN_PROGRESS.includes(status)) loadResults();
    previous.current = status;
  }, [status, loadResults]);

  const processing = status ? IN_PROGRESS.includes(status) : false;
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(loadMeeting, 2000);
    return () => clearInterval(timer);
  }, [processing, loadMeeting]);

  const run = useCallback(async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const startProcessing = (retranscribe: boolean) =>
    run('process', async () => {
      setMeeting({ ...(meeting as MeetingDetail), ...(await api.processMeeting(meetingId, retranscribe)) });
    });

  // Adding a recording or transcript starts the pipeline right away, like ending a call does.
  // Skipped while a run is in progress; "Process again" picks the new content up afterwards.
  const processAfterAdding = async () => {
    if (processing) return;
    const started = await api.processMeeting(meetingId);
    setMeeting((current) => (current ? { ...current, ...started } : current));
  };

  const addFile = () =>
    run('upload', async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      await api.uploadRecording(meetingId, {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        blob: asset.file,
      });
      await processAfterAdding();
      await Promise.all([loadMeeting(), loadResults()]);
    });

  const importTranscript = () =>
    run('import', async () => {
      await api.importTranscript(meetingId, importText);
      setImportText('');
      setShowImport(false);
      await processAfterAdding();
      await Promise.all([loadMeeting(), loadResults()]);
    });

  const remove = async () => {
    if (!(await confirm('Delete this meeting?', 'It disappears from the list and from search.', 'Delete'))) return;
    await run('delete', async () => {
      await api.deleteMeeting(meetingId);
      nav.pop();
    });
  };

  return (
    <Screen title={meeting?.title ?? 'Meeting'} onBack={nav.pop}>
      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable key={item.id} onPress={() => setTab(item.id)} style={[styles.tab, tab === item.id && styles.tabActive]}>
            <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {!meeting && !error ? <ActivityIndicator style={{ marginTop: space.xl }} color={colors.primary} /> : null}

      {tab === 'ask' ? (
        <View style={{ flex: 1 }}>
          {meeting && meeting.status !== 'READY' ? (
            <View style={{ paddingHorizontal: space.lg }}>
              <Muted>Questions work once the meeting is Ready (recorded, transcribed and indexed).</Muted>
            </View>
          ) : null}
          <ChatPanel meetingId={meetingId} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg }}>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />

          {tab === 'overview' && meeting ? (
            <Overview
              meeting={meeting}
              summary={summary}
              enrichment={enrichment}
              recordingCount={recordings.length}
              busy={busy}
              processing={processing}
              showImport={showImport}
              importText={importText}
              onImportText={setImportText}
              onToggleImport={() => setShowImport((v) => !v)}
              onImport={importTranscript}
              onStart={() => nav.push({ name: 'call', id: meetingId })}
              onAddFile={addFile}
              onProcess={startProcessing}
              onDelete={remove}
            />
          ) : null}
          {tab === 'transcript' ? <TranscriptView transcripts={transcripts} /> : null}
          {tab === 'recordings' ? <RecordingsView recordings={recordings} /> : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function Overview({
  meeting,
  summary,
  enrichment,
  recordingCount,
  busy,
  processing,
  showImport,
  importText,
  onImportText,
  onToggleImport,
  onImport,
  onStart,
  onAddFile,
  onProcess,
  onDelete,
}: {
  meeting: MeetingDetail;
  summary: Summary | null;
  enrichment: Enrichment | null;
  recordingCount: number;
  busy: string | null;
  processing: boolean;
  showImport: boolean;
  importText: string;
  onImportText: (text: string) => void;
  onToggleImport: () => void;
  onImport: () => void;
  onStart: () => void;
  onAddFile: () => void;
  onProcess: (retranscribe: boolean) => void;
  onDelete: () => void;
}) {
  const finished = meeting.status === 'READY' || meeting.status === 'FAILED';
  const hasContent = recordingCount > 0 || meeting.status === 'RECORDED' || meeting.status === 'READY';
  return (
    <>
      <Card>
        <View style={styles.headRow}>
          <StatusBadge status={meeting.status} />
        </View>
        {meeting.description ? <Text style={styles.description}>{meeting.description}</Text> : null}
        {meeting.scheduled_at ? <Muted>Scheduled: {formatDateTime(meeting.scheduled_at)}</Muted> : null}
        {meeting.started_at ? <Muted>Started: {formatDateTime(meeting.started_at)}</Muted> : null}
        {meeting.ended_at ? <Muted>Ended: {formatDateTime(meeting.ended_at)}</Muted> : null}
        {meeting.participants.length > 0 ? (
          <Muted>With: {meeting.participants.map((p) => p.name).join(', ')}</Muted>
        ) : null}
        {meeting.status === 'FAILED' && meeting.error_message ? (
          <Text style={styles.failure}>{meeting.error_message}</Text>
        ) : null}
        {processing ? (
          <View style={{ marginTop: space.md }}>
            <PipelineProgress status={meeting.status} />
          </View>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Actions</SectionTitle>
        <View style={{ gap: space.sm }}>
          <Button title="Start" onPress={onStart} disabled={processing} />
          <View style={styles.actionRow}>
            <Button title="Add audio/video file" variant="secondary" onPress={onAddFile} loading={busy === 'upload'} style={{ flex: 1 }} />
            <Button title="Import transcript" variant="secondary" onPress={onToggleImport} style={{ flex: 1 }} />
          </View>
          {showImport ? (
            <View>
              <Field
                label={'Transcript — one line per utterance, "Name: words" sets the speaker'}
                value={importText}
                onChangeText={onImportText}
                multiline
                placeholder={'Ana: We decided to cut the cloud budget by 10%.\nBob: I will send the numbers by Friday.'}
                autoCapitalize="sentences"
              />
              <Button title="Save transcript" onPress={onImport} disabled={!importText.trim()} loading={busy === 'import'} />
            </View>
          ) : null}
          <Button
            title={finished ? 'Process again' : 'Process'}
            onPress={() => onProcess(false)}
            disabled={processing || !hasContent}
            loading={busy === 'process'}
          />
          {finished && recordingCount > 0 ? (
            <Button title="Process again, re-transcribing the audio" variant="ghost" onPress={() => onProcess(true)} disabled={processing} />
          ) : null}
          <Button title="Delete meeting" variant="ghost" onPress={onDelete} disabled={processing} />
        </View>
      </Card>

      {summary ? (
        <Card>
          <SectionTitle>Summary{summary.version > 1 ? ` (v${summary.version})` : ''}</SectionTitle>
          <SimpleMarkdown text={summary.content} />
        </Card>
      ) : meeting.status === 'READY' ? null : (
        <Card>
          <SectionTitle>Summary</SectionTitle>
          <Muted>Appears here after the meeting has been processed.</Muted>
        </Card>
      )}

      {enrichment && enrichment.action_items.length > 0 ? (
        <Card>
          <SectionTitle>Action items</SectionTitle>
          {enrichment.action_items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Text style={styles.itemText}>{item.description}</Text>
              <Muted>
                {[item.owner ? `Owner: ${item.owner}` : null, item.due_date ? `Due: ${item.due_date}` : null]
                  .filter(Boolean)
                  .join('  ·  ') || ' '}
              </Muted>
            </View>
          ))}
        </Card>
      ) : null}

      {enrichment && enrichment.decisions.length > 0 ? (
        <Card>
          <SectionTitle>Decisions</SectionTitle>
          {enrichment.decisions.map((decision) => (
            <Text key={decision.id} style={[styles.itemText, styles.item]}>
              • {decision.description}
            </Text>
          ))}
        </Card>
      ) : null}

      {enrichment && enrichment.topics.length > 0 ? (
        <Card>
          <SectionTitle>Topics</SectionTitle>
          <View style={styles.topics}>
            {enrichment.topics.map((topic) => (
              <View key={topic.id} style={styles.topic}>
                <Text style={styles.topicText}>{topic.name}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </>
  );
}

function TranscriptView({ transcripts }: { transcripts: Transcript[] }) {
  if (transcripts.length === 0) {
    return (
      <Card>
        <Muted>No transcript yet. Process a recording, or import a transcript from the Overview tab.</Muted>
      </Card>
    );
  }
  return (
    <>
      {transcripts.map((transcript) => (
        <Card key={transcript.id}>
          <SectionTitle>
            {transcript.source === 'STT' ? 'Speech-to-text' : 'Imported'}
            {transcript.language ? ` · ${transcript.language}` : ''}
            {transcript.duration_ms ? ` · ${formatDuration(transcript.duration_ms)}` : ''}
          </SectionTitle>
          {transcript.segments.map((segment) => (
            <View key={segment.id} style={styles.segment}>
              <Text style={styles.segmentMeta}>
                {[formatRange(segment.start_ms, segment.end_ms), segment.speaker].filter(Boolean).join('  ·  ')}
              </Text>
              <Text style={styles.itemText} selectable>
                {segment.text}
              </Text>
            </View>
          ))}
        </Card>
      ))}
    </>
  );
}

function RecordingsView({ recordings }: { recordings: Recording[] }) {
  if (recordings.length === 0) {
    return (
      <Card>
        <Muted>Nothing recorded yet. Start the meeting, or add an audio/video file from the Overview tab.</Muted>
      </Card>
    );
  }
  return (
    <>
      {recordings.map((recording) => (
        <Card key={recording.id}>
          <Text style={styles.itemText}>{recording.filename}</Text>
          <Muted>
            {[
              formatBytes(recording.size_bytes),
              recording.content_type,
              recording.duration_ms ? formatDuration(recording.duration_ms) : null,
              formatDateTime(recording.created_at),
            ]
              .filter(Boolean)
              .join('  ·  ')}
          </Muted>
          <Text style={styles.hash} numberOfLines={1}>
            sha256 {recording.sha256}
          </Text>
        </Card>
      ))}
    </>
  );
}

const styles = createStyles(() => StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'flex-start',
    marginHorizontal: space.lg,
    marginBottom: space.md,
    padding: 4,
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: 999,
    ...shadow,
  },
  tab: { paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: 999 },
  tabActive: { backgroundColor: colors.navy },
  tabText: { color: colors.muted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#ffffff' },
  headRow: { flexDirection: 'row', marginBottom: space.sm },
  description: { color: colors.text, fontSize: 15, marginBottom: space.sm },
  failure: { color: colors.danger, marginTop: space.sm, fontSize: 14 },
  actionRow: { flexDirection: 'row', gap: space.sm },
  item: { marginBottom: space.sm },
  itemText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  topic: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: space.md, paddingVertical: space.xs },
  topicText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  segment: { marginBottom: space.md },
  segmentMeta: { color: colors.primary, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  hash: { color: colors.muted, fontSize: 11, marginTop: space.xs },
}));
