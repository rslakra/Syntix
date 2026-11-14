// The demo backend: an in-memory stand-in for the iws API, so the whole app works without a server.
//
// It serves the sample meetings (ids "sample-…") and any meeting created while the API is
// unreachable (ids "demo-…"). It mimics the real pipeline's states and timings, but it does not
// transcribe audio or call a language model: recordings get a scripted transcript, and answers are
// built from keyword matches. Everything is kept in memory and is gone on reload.
import { SAMPLE_CONTACTS, buildSampleMeetings, scriptFor } from '../data/sample';
import type {
  ActionItem,
  Answer,
  Conversation,
  Decision,
  Enrichment,
  Meeting,
  MeetingDetail,
  MeetingStatus,
  MeetingUpdate,
  Message,
  NewMeeting,
  Participant,
  RecordedMedia,
  Recording,
  Segment,
  Source,
  Summary,
  Topic,
  Transcript,
} from '../types';
import { IN_PROGRESS } from '../types';
import { ApiError } from './errors';

/** Sample and demo meetings, and their conversations, are handled here instead of by the API. */
export const isDemoId = (id?: string | null): boolean => !!id && (id.startsWith('sample-') || id.startsWith('demo-'));

interface Entry {
  meeting: MeetingDetail;
  recordings: Recording[];
  transcripts: Transcript[];
  summary: Summary | null;
  enrichment: Enrichment;
}

interface Thread {
  conversation: Conversation;
  messages: Message[];
}

const entries = new Map<string, Entry>();
const threads: Thread[] = [];
let seeded = false;
let counter = 0;

const nextId = (prefix: string) => `${prefix}-${++counter}`;
const now = () => new Date().toISOString();
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// --- building the content ------------------------------------------------------------------------

const ACTION = /\b(will|action item)\b/i;
const DECISION = /\b(decided|agreed|decision)\b/i;
const TOPICS = ['budget', 'launch', 'hiring', 'design', 'customer', 'roadmap', 'security', 'onboarding', 'finance', 'reports', 'search', 'feedback'];

function buildSegments(lines: [speaker: string | null, text: string][]): Segment[] {
  return lines.map(([speaker, text], index) => {
    const start = 4_000 + index * 21_000;
    return { id: nextId('demo-seg'), seq: index, speaker, start_ms: start, end_ms: start + Math.max(8_000, text.length * 70), text };
  });
}

function transcriptOf(meetingId: string, source: 'STT' | 'IMPORTED', segments: Segment[], recordingId: string | null): Transcript {
  const last = segments[segments.length - 1];
  return {
    id: nextId('demo-tr'),
    meeting_id: meetingId,
    recording_id: recordingId,
    source,
    language: 'en',
    model: source === 'STT' ? 'demo (scripted)' : null,
    duration_ms: last ? (last.end_ms ?? 0) + 2_000 : null,
    created_at: now(),
    segments,
  };
}

function recordingOf(meetingId: string, filename: string, size: number, contentType: string | null, durationMs: number | null): Recording {
  const id = nextId('demo-rec');
  return {
    id,
    meeting_id: meetingId,
    filename,
    content_type: contentType,
    size_bytes: size,
    sha256: Array.from({ length: 8 }, (_, i) => ((counter * 2654435761 + i * 40503) >>> 0).toString(16).padStart(8, '0')).join(''),
    duration_ms: durationMs,
    created_at: now(),
  };
}

/** Action items, decisions, topics and a Markdown summary, found by keyword in the transcript. */
function analyse(title: string, segments: Segment[]): { enrichment: Enrichment; summary: string } {
  const actionItems: ActionItem[] = segments
    .filter((s) => ACTION.test(s.text))
    .map((s) => ({
      id: nextId('demo-ai'),
      description: s.text.replace(/^Action item:\s*/i, ''),
      owner: s.speaker,
      due_date: null,
      status: 'OPEN',
    }));
  const decisions: Decision[] = segments
    .filter((s) => DECISION.test(s.text))
    .map((s) => ({ id: nextId('demo-dec'), description: s.text }));
  const all = segments.map((s) => s.text).join(' ').toLowerCase();
  const topics: Topic[] = TOPICS.filter((t) => all.includes(t)).map((t) => ({ id: nextId('demo-topic'), name: t[0].toUpperCase() + t.slice(1) }));
  const speakers = [...new Set(segments.map((s) => s.speaker).filter((s): s is string => !!s))];

  const lines = [
    `## ${title}`,
    `${speakers.length || 'Several'} participant${speakers.length === 1 ? '' : 's'}${speakers.length ? ` (${speakers.join(', ')})` : ''} covered ${
      topics.length ? topics.map((t) => t.name.toLowerCase()).join(', ') : 'the agenda'
    }.`,
  ];
  if (decisions.length) lines.push('', '### Decisions', ...decisions.map((d) => `- ${d.description}`));
  if (actionItems.length) lines.push('', '### Action items', ...actionItems.map((a) => `- ${a.owner ? `${a.owner}: ` : ''}${a.description}`));
  lines.push('', '_Demo summary: generated from keywords, not by an AI model._');
  return { enrichment: { action_items: actionItems, decisions, topics }, summary: lines.join('\n') };
}

function applyAnalysis(entry: Entry): void {
  const segments = entry.transcripts.flatMap((t) => t.segments);
  const { enrichment, summary } = analyse(entry.meeting.title, segments);
  entry.enrichment = enrichment;
  entry.summary = {
    id: nextId('demo-sum'),
    meeting_id: entry.meeting.id,
    version: (entry.summary?.version ?? 0) + 1,
    content: summary,
    model: 'demo (keywords)',
    created_at: now(),
  };
}

function seed(): void {
  if (seeded) return;
  seeded = true;
  buildSampleMeetings().forEach((meeting, index) => {
    const participants: Participant[] = [0, 1, 2].map((k) => {
      const person = SAMPLE_CONTACTS[(index + k) % SAMPLE_CONTACTS.length];
      return { id: nextId('demo-p'), name: person.name, email: person.email };
    });
    const entry: Entry = {
      meeting: { ...meeting, participants },
      recordings: [],
      transcripts: [],
      summary: null,
      enrichment: { action_items: [], decisions: [], topics: [] },
    };
    if (meeting.status === 'READY' || meeting.status === 'FAILED' || meeting.status === 'RECORDED') {
      entry.recordings.push(recordingOf(meeting.id, 'meeting.webm', 2_400_000, 'audio/webm', 150_000));
    }
    if (meeting.status === 'READY') {
      entry.transcripts.push(transcriptOf(meeting.id, 'STT', buildSegments(scriptFor(meeting.title)), entry.recordings[0]?.id ?? null));
      applyAnalysis(entry);
    }
    entries.set(meeting.id, entry);
  });
}

function entryOf(id: string): Entry {
  seed();
  const entry = entries.get(id);
  if (!entry) throw new ApiError(404, `Meeting ${id} not found`);
  return entry;
}

const plain = ({ participants: _participants, ...meeting }: MeetingDetail): Meeting => meeting;

// --- the pipeline ----------------------------------------------------------------------------------

const STEPS: [MeetingStatus, number][] = [
  ['TRANSCRIBING', 900],
  ['ENRICHING', 1800],
  ['SUMMARIZING', 1800],
  ['INDEXING', 1500],
  ['READY', 1500],
];

function advance(id: string, status: MeetingStatus, retranscribe: boolean): void {
  const entry = entries.get(id);
  if (!entry) return; // deleted meanwhile
  const { meeting } = entry;
  if (status === 'TRANSCRIBING') {
    if (retranscribe) entry.transcripts = entry.transcripts.filter((t) => t.source !== 'STT');
    const recording = entry.recordings[0];
    const transcribed = entry.transcripts.some((t) => t.recording_id === recording?.id);
    if (recording && !transcribed) {
      entry.transcripts.push(transcriptOf(id, 'STT', buildSegments(scriptFor(meeting.title)), recording.id));
    }
    if (entry.transcripts.length === 0) {
      meeting.status = 'FAILED';
      meeting.error_message = 'No speech was found in the recordings';
      meeting.updated_at = now();
      return;
    }
  }
  if (meeting.status === 'FAILED') return;
  meeting.status = status;
  meeting.updated_at = now();
  if (status === 'READY') applyAnalysis(entry);
}

// --- questions -------------------------------------------------------------------------------------

const STOP = new Set(['the', 'and', 'for', 'are', 'was', 'were', 'that', 'this', 'what', 'which', 'who', 'how', 'did', 'does', 'about', 'from', 'with', 'tell', 'list', 'give', 'show', 'any', 'has', 'have', 'had', 'there', 'their', 'them', 'they']);
const stem = (word: string) => word.replace(/(ing|ed|es|s)$/, '');
const keywords = (text: string) =>
  (text.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem).filter((w) => w.length >= 3);

function sourceOf(entry: Entry, segment: Segment, index: number, score: number): Source {
  return {
    index,
    chunk_id: `demo-chunk-${segment.id}`,
    meeting_id: entry.meeting.id,
    meeting_title: entry.meeting.title,
    source: 'TRANSCRIPT',
    start_ms: segment.start_ms,
    end_ms: segment.end_ms,
    score,
    text: `${segment.speaker ? `${segment.speaker}: ` : ''}${segment.text}`,
  };
}

function scopeOf(meetingId?: string | null): Entry[] {
  seed();
  if (meetingId) return [entryOf(meetingId)];
  return [...entries.values()].filter((e) => e.meeting.status === 'READY');
}

function retrieve(query: string, scope: Entry[], limit: number): Source[] {
  const words = keywords(query);
  const hits: { entry: Entry; segment: Segment; matches: number }[] = [];
  for (const entry of scope) {
    for (const segment of entry.transcripts.flatMap((t) => t.segments)) {
      const haystack = `${segment.text} ${entry.meeting.title}`.toLowerCase();
      const matches = words.filter((w) => haystack.includes(w)).length;
      if (matches > 0) hits.push({ entry, segment, matches });
    }
  }
  hits.sort((a, b) => b.matches - a.matches);
  return hits.slice(0, limit).map((hit, index) => sourceOf(hit.entry, hit.segment, index + 1, Math.min(0.96, 0.45 + 0.17 * hit.matches)));
}

function matching(pattern: RegExp, scope: Entry[], limit: number): Source[] {
  const found: Source[] = [];
  for (const entry of scope) {
    for (const segment of entry.transcripts.flatMap((t) => t.segments)) {
      if (pattern.test(segment.text) && found.length < limit) found.push(sourceOf(entry, segment, found.length + 1, 0.9));
    }
  }
  return found;
}

const FOOTER = '\n\n(Demo answer: built from keyword matches in the demo meetings, not by an AI model.)';

function answerFor(question: string, scope: Entry[], label: string): { text: string; sources: Source[] } {
  const q = question.toLowerCase();
  const withContent = scope.filter((e) => e.transcripts.length > 0);
  if (withContent.length === 0) {
    return { text: 'There is nothing to search yet: process a meeting first (a recording or a transcript).', sources: [] };
  }
  if (/decision|decide/.test(q)) {
    const lines = withContent.flatMap((e) => e.enrichment.decisions.map((d) => `• ${d.description} (${e.meeting.title})`)).slice(0, 8);
    if (lines.length) return { text: `Decisions made in ${label}:\n\n${lines.join('\n')}${FOOTER}`, sources: matching(DECISION, withContent, 4) };
  }
  if (/action item|task|to-?do|owner|follow.?up/.test(q)) {
    const lines = withContent
      .flatMap((e) => e.enrichment.action_items.map((a) => `• ${a.owner ? `${a.owner}: ` : ''}${a.description} (${e.meeting.title})`))
      .slice(0, 8);
    if (lines.length) return { text: `Action items from ${label}:\n\n${lines.join('\n')}${FOOTER}`, sources: matching(ACTION, withContent, 4) };
  }
  if (/summar|overview|recap/.test(q)) {
    const lines = withContent.slice(0, 3).map((e) => {
      const topics = e.enrichment.topics.map((t) => t.name.toLowerCase()).join(', ') || 'the agenda';
      return `• ${e.meeting.title}: ${e.enrichment.decisions.length} decision(s) and ${e.enrichment.action_items.length} action item(s), about ${topics}.`;
    });
    const sources = withContent.slice(0, 3).flatMap((e, i) => {
      const first = e.transcripts[0]?.segments[0];
      return first ? [sourceOf(e, first, i + 1, 0.8)] : [];
    });
    return { text: `A short summary of ${label}:\n\n${lines.join('\n')}${FOOTER}`, sources };
  }
  const sources = retrieve(question, withContent, 4);
  if (sources.length === 0) return { text: `I could not find anything about that in ${label}.${FOOTER}`, sources: [] };
  return { text: `Here is what ${label} say:\n\n${sources.map((s) => `${s.text} [${s.index}]`).join('\n\n')}${FOOTER}`, sources };
}

// --- the API ---------------------------------------------------------------------------------------

export const mockApi = {
  listMeetings: async (): Promise<Meeting[]> => {
    seed();
    return [...entries.values()].map((e) => plain(e.meeting));
  },

  getMeeting: async (id: string): Promise<MeetingDetail> => ({ ...entryOf(id).meeting }),

  createMeeting: async (body: NewMeeting): Promise<MeetingDetail> => {
    seed();
    const id = nextId('demo');
    const meeting: MeetingDetail = {
      id,
      title: body.title,
      description: body.description ?? null,
      language: body.language ?? null,
      scheduled_at: body.scheduled_at ?? null,
      started_at: body.started_at ?? null,
      ended_at: body.ended_at ?? null,
      status: 'CREATED',
      error_message: null,
      created_at: now(),
      updated_at: now(),
      participants: (body.participants ?? []).map((p) => ({ id: nextId('demo-p'), name: p.name, email: p.email ?? null })),
    };
    entries.set(id, { meeting, recordings: [], transcripts: [], summary: null, enrichment: { action_items: [], decisions: [], topics: [] } });
    return { ...meeting };
  },

  updateMeeting: async (id: string, body: MeetingUpdate): Promise<MeetingDetail> => {
    const entry = entryOf(id);
    Object.assign(entry.meeting, body, { updated_at: now() });
    return { ...entry.meeting };
  },

  deleteMeeting: async (id: string): Promise<void> => {
    entryOf(id);
    entries.delete(id);
  },

  listRecordings: async (id: string): Promise<Recording[]> => [...entryOf(id).recordings],

  uploadRecording: async (id: string, media: Pick<RecordedMedia, 'uri' | 'name' | 'mimeType' | 'blob'>): Promise<Recording> => {
    const entry = entryOf(id);
    const recording = recordingOf(id, media.name, media.blob?.size ?? 1_200_000, media.mimeType, null);
    entry.recordings.push(recording);
    if (entry.meeting.status === 'CREATED') entry.meeting.status = 'RECORDED';
    entry.meeting.updated_at = now();
    return recording;
  },

  getTranscripts: async (id: string): Promise<Transcript[]> => [...entryOf(id).transcripts],

  importTranscript: async (id: string, text: string): Promise<Transcript> => {
    const entry = entryOf(id);
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line): [string | null, string] => {
        const match = /^([^:]{1,40}):\s*(.+)$/.exec(line);
        return match ? [match[1], match[2]] : [null, line];
      });
    if (lines.length === 0) throw new ApiError(400, 'Transcript is empty');
    const transcript = transcriptOf(id, 'IMPORTED', buildSegments(lines), null);
    entry.transcripts.push(transcript);
    if (entry.meeting.status === 'CREATED') entry.meeting.status = 'RECORDED';
    entry.meeting.updated_at = now();
    return transcript;
  },

  processMeeting: async (id: string, retranscribe = false): Promise<Meeting> => {
    const entry = entryOf(id);
    const { meeting } = entry;
    if (IN_PROGRESS.includes(meeting.status)) {
      throw new ApiError(409, `Meeting is already being processed (${meeting.status})`);
    }
    if (entry.recordings.length === 0 && entry.transcripts.length === 0) {
      throw new ApiError(400, 'Upload a recording or import a transcript before processing');
    }
    meeting.status = 'QUEUED';
    meeting.error_message = null;
    meeting.updated_at = now();
    let at = 0;
    for (const [status, step] of STEPS) {
      at += step;
      setTimeout(() => advance(id, status, retranscribe), at);
    }
    return plain(meeting);
  },

  getSummary: async (id: string): Promise<Summary | null> => entryOf(id).summary,

  getEnrichment: async (id: string): Promise<Enrichment> => entryOf(id).enrichment,

  ask: async (body: { question: string; meeting_id?: string | null; conversation_id?: string | null }): Promise<Answer> => {
    await wait(700); // so "Syntix is thinking…" is visible, as with a real model
    const scope = scopeOf(body.meeting_id);
    const label = body.meeting_id ? `"${scope[0]?.meeting.title}"` : 'your meetings';
    const { text, sources } = answerFor(body.question, scope, label);

    let thread = threads.find((t) => t.conversation.id === body.conversation_id);
    if (!thread) {
      thread = {
        conversation: { id: nextId('demo-conv'), meeting_id: body.meeting_id ?? null, title: body.question.slice(0, 60), created_at: now() },
        messages: [],
      };
      threads.unshift(thread);
    }
    thread.messages.push({ id: nextId('demo-msg'), role: 'USER', content: body.question, sources: null, created_at: now() });
    const reply: Message = { id: nextId('demo-msg'), role: 'ASSISTANT', content: text, sources, created_at: now() };
    thread.messages.push(reply);
    return { conversation_id: thread.conversation.id, message_id: reply.id, answer: text, sources };
  },

  search: async (body: { query: string; meeting_id?: string | null }): Promise<Source[]> => {
    await wait(300);
    return retrieve(body.query, scopeOf(body.meeting_id), 8);
  },

  listConversations: async (meetingId?: string | null): Promise<Conversation[]> =>
    threads.filter((t) => !meetingId || t.conversation.meeting_id === meetingId).map((t) => ({ ...t.conversation })),

  getMessages: async (conversationId: string): Promise<Message[]> => {
    const thread = threads.find((t) => t.conversation.id === conversationId);
    if (!thread) throw new ApiError(404, `Conversation ${conversationId} not found`);
    return [...thread.messages];
  },
};
