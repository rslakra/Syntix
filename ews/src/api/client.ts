import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getDataSource, getDemoReason, setDemoReason } from './demo';
import { ApiError } from './errors';
import { isDemoId, mockApi } from './mock';
import type {
  Answer,
  Conversation,
  Enrichment,
  Meeting,
  MeetingDetail,
  MeetingUpdate,
  Message,
  NewMeeting,
  RecordedMedia,
  Recording,
  Source,
  Summary,
  Transcript,
} from '../types';

const STORAGE_KEY = 'syntix.apiUrl';

/**
 * Where the iws API is. Order: saved in Settings → EXPO_PUBLIC_API_URL → platform default.
 * The Android emulator reaches the host machine at 10.0.2.2; a real phone needs the computer's LAN IP.
 */
function defaultBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  return Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
}

let baseUrl = defaultBaseUrl();

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function getBaseUrl(): string {
  return baseUrl;
}

export function getDefaultBaseUrl(): string {
  return defaultBaseUrl();
}

export async function loadBaseUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) baseUrl = normalize(saved);
  } catch {
    // Storage unavailable: keep the default.
  }
  return baseUrl;
}

export async function saveBaseUrl(url: string): Promise<void> {
  const next = normalize(url) || defaultBaseUrl();
  baseUrl = next;
  await AsyncStorage.setItem(STORAGE_KEY, next);
}

export { ApiError };

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function detailToText(detail: unknown): string | null {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (item && typeof item === 'object' && 'msg' in item ? String(item.msg) : String(item)))
      .join('; ');
  }
  return null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      `Cannot reach the Syntix API at ${baseUrl}. Start it with "make start" in AiSuite/Syntix/iws, ` +
      'or fix the URL in Settings.',
    );
  }
  return parse<T>(response);
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data && typeof data === 'object' && 'detail' in data ? (data as { detail: unknown }).detail : null;
    throw new ApiError(response.status, detailToText(detail) ?? `Request failed (${response.status})`);
  }
  return data as T;
}

const json = {
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
};

async function orNull<T>(call: Promise<T>): Promise<T | null> {
  try {
    return await call;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** The real iws API, over HTTP. The app talks to `api` below, which routes between this and the demo backend. */
const liveApi = {
  health: () => request<{ status: string; app: string; env: string }>('GET', '/health'),

  // --- meetings
  listMeetings: () => request<Meeting[]>('GET', '/meetings?limit=200'),
  getMeeting: (id: string) => request<MeetingDetail>('GET', `/meetings/${id}`),
  createMeeting: (body: NewMeeting) => request<MeetingDetail>('POST', '/meetings', body),
  updateMeeting: (id: string, body: MeetingUpdate) => request<MeetingDetail>('PATCH', `/meetings/${id}`, body),
  deleteMeeting: (id: string) => request<void>('DELETE', `/meetings/${id}`),

  // --- recordings and transcripts
  listRecordings: (id: string) => request<Recording[]>('GET', `/meetings/${id}/recordings`),
  uploadRecording: async (id: string, media: Pick<RecordedMedia, 'uri' | 'name' | 'mimeType' | 'blob'>) => {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = media.blob ?? (await (await fetch(media.uri)).blob());
      form.append('file', blob, media.name);
    } else {
      // React Native reads the file from its URI when the request is sent.
      form.append('file', { uri: media.uri, name: media.name, type: media.mimeType } as unknown as Blob);
    }
    let response: Response;
    try {
      // No Content-Type header: fetch adds the multipart boundary itself.
      response = await fetch(`${baseUrl}/meetings/${id}/recordings`, { method: 'POST', body: form });
    } catch {
      throw new ApiError(0, `Cannot reach the Syntix API at ${baseUrl} to upload the recording.`);
    }
    return parse<Recording>(response);
  },
  getTranscripts: (id: string) => request<Transcript[]>('GET', `/meetings/${id}/transcript`),
  importTranscript: (id: string, text: string) =>
    json.post<Transcript>(`/meetings/${id}/transcript`, { text }),

  // --- pipeline results
  processMeeting: (id: string, retranscribe = false) =>
    json.post<Meeting>(`/meetings/${id}/process?retranscribe=${retranscribe}`),
  getSummary: (id: string) => orNull(request<Summary>('GET', `/meetings/${id}/summary`)),
  getEnrichment: (id: string) => request<Enrichment>('GET', `/meetings/${id}/enrichment`),

  // --- questions
  ask: (body: { question: string; meeting_id?: string | null; conversation_id?: string | null }) =>
    json.post<Answer>('/ask', body),
  search: (body: { query: string; meeting_id?: string | null }) => json.post<Source[]>('/search', body),
  listConversations: (meetingId?: string | null) =>
    request<Conversation[]>('GET', meetingId ? `/conversations?meeting_id=${meetingId}` : '/conversations'),
  getMessages: (conversationId: string) =>
    request<Message[]>('GET', `/conversations/${conversationId}/messages`),
};

export type Api = typeof liveApi;

// --- routing between the live API and the demo backend ------------------------------------------
//
// The rules (see "Demo data" in the README):
//  - anything about a demo meeting (id starting "sample-" or "demo-") goes to the demo backend;
//  - lists and new meetings go to the live API, and in automatic mode fall back to the demo backend
//    when it cannot be reached (lists also when the API has no meetings yet);
//  - Settings → Data source can force the live API or the demo data.

const isNetworkFailure = (error: unknown) => error instanceof ApiError && error.status === 0;

/** True when this id, or the whole app, is on demo data. */
const forDemo = (id?: string | null) => isDemoId(id) || getDataSource() === 'demo';

/** Runs `live`; in automatic mode, an unreachable API is answered by `demo` instead. */
async function liveOrDemo<R>(live: () => Promise<R>, demo: () => Promise<R>): Promise<R> {
  if (getDataSource() === 'demo') {
    setDemoReason('forced');
    return demo();
  }
  try {
    return await live();
  } catch (error) {
    if (getDataSource() === 'auto' && isNetworkFailure(error)) {
      setDemoReason('unreachable');
      return demo();
    }
    throw error;
  }
}

export const api: Api = {
  health: liveApi.health,

  listMeetings: async () => {
    const source = getDataSource();
    if (source === 'demo') {
      setDemoReason('forced');
      return mockApi.listMeetings();
    }
    try {
      const list = await liveApi.listMeetings();
      if (list.length === 0 && source === 'auto') {
        setDemoReason('no-meetings');
        return mockApi.listMeetings();
      }
      setDemoReason(null);
      return list;
    } catch (error) {
      if (source === 'auto' && isNetworkFailure(error)) {
        setDemoReason('unreachable');
        return mockApi.listMeetings();
      }
      throw error;
    }
  },
  getMeeting: (id) => (forDemo(id) ? mockApi.getMeeting(id) : liveApi.getMeeting(id)),
  createMeeting: (body) => liveOrDemo(() => liveApi.createMeeting(body), () => mockApi.createMeeting(body)),
  updateMeeting: (id, body) => (forDemo(id) ? mockApi.updateMeeting(id, body) : liveApi.updateMeeting(id, body)),
  deleteMeeting: (id) => (forDemo(id) ? mockApi.deleteMeeting(id) : liveApi.deleteMeeting(id)),

  listRecordings: (id) => (forDemo(id) ? mockApi.listRecordings(id) : liveApi.listRecordings(id)),
  uploadRecording: (id, media) => (forDemo(id) ? mockApi.uploadRecording(id, media) : liveApi.uploadRecording(id, media)),
  getTranscripts: (id) => (forDemo(id) ? mockApi.getTranscripts(id) : liveApi.getTranscripts(id)),
  importTranscript: (id, text) => (forDemo(id) ? mockApi.importTranscript(id, text) : liveApi.importTranscript(id, text)),

  processMeeting: (id, retranscribe) =>
    forDemo(id) ? mockApi.processMeeting(id, retranscribe) : liveApi.processMeeting(id, retranscribe),
  getSummary: (id) => (forDemo(id) ? mockApi.getSummary(id) : liveApi.getSummary(id)),
  getEnrichment: (id) => (forDemo(id) ? mockApi.getEnrichment(id) : liveApi.getEnrichment(id)),

  ask: (body) => {
    // With demo meetings on screen, a question about "all meetings" is about the demo meetings.
    const demo = forDemo(body.meeting_id) || isDemoId(body.conversation_id) || (getDemoReason() !== null && !body.meeting_id);
    return demo ? mockApi.ask(body) : liveOrDemo(() => liveApi.ask(body), () => mockApi.ask(body));
  },
  search: (body) =>
    getDemoReason() !== null || forDemo(body.meeting_id)
      ? mockApi.search(body)
      : liveOrDemo(() => liveApi.search(body), () => mockApi.search(body)),
  listConversations: (meetingId) =>
    getDemoReason() !== null || forDemo(meetingId)
      ? mockApi.listConversations(meetingId)
      : liveOrDemo(() => liveApi.listConversations(meetingId), () => mockApi.listConversations(meetingId)),
  getMessages: (id) => (forDemo(id) ? mockApi.getMessages(id) : liveApi.getMessages(id)),
};
