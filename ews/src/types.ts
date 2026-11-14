// Mirrors the pydantic schemas of the iws API (AiSuite/Syntix/iws/app/schemas).

export type MeetingStatus =
  | 'CREATED'
  | 'RECORDED'
  | 'QUEUED'
  | 'TRANSCRIBING'
  | 'ENRICHING'
  | 'SUMMARIZING'
  | 'INDEXING'
  | 'READY'
  | 'FAILED';

export const IN_PROGRESS: MeetingStatus[] = [
  'QUEUED',
  'TRANSCRIBING',
  'ENRICHING',
  'SUMMARIZING',
  'INDEXING',
];

export interface Participant {
  id: string;
  name: string;
  email: string | null;
}

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  language: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: MeetingStatus;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MeetingDetail extends Meeting {
  participants: Participant[];
}

export interface NewMeeting {
  title: string;
  description?: string | null;
  language?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  participants?: { name: string; email?: string | null }[];
}

export type MeetingUpdate = Partial<
  Pick<NewMeeting, 'title' | 'description' | 'language' | 'scheduled_at' | 'started_at' | 'ended_at'>
>;

export interface Recording {
  id: string;
  meeting_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number;
  sha256: string;
  duration_ms: number | null;
  created_at: string | null;
}

export interface Segment {
  id: string;
  seq: number;
  speaker: string | null;
  start_ms: number | null;
  end_ms: number | null;
  text: string;
}

export interface Transcript {
  id: string;
  meeting_id: string;
  recording_id: string | null;
  source: 'STT' | 'IMPORTED' | string;
  language: string | null;
  model: string | null;
  duration_ms: number | null;
  created_at: string | null;
  segments: Segment[];
}

export interface ActionItem {
  id: string;
  description: string;
  owner: string | null;
  due_date: string | null;
  status: string;
}

export interface Decision {
  id: string;
  description: string;
}

export interface Topic {
  id: string;
  name: string;
}

export interface Enrichment {
  action_items: ActionItem[];
  decisions: Decision[];
  topics: Topic[];
}

export interface Summary {
  id: string;
  meeting_id: string;
  version: number;
  content: string;
  model: string | null;
  created_at: string | null;
}

export interface Source {
  index: number;
  chunk_id: string;
  meeting_id: string;
  meeting_title: string;
  source: string;
  start_ms: number | null;
  end_ms: number | null;
  score: number;
  text: string;
}

export interface Answer {
  conversation_id: string;
  message_id: string;
  answer: string;
  sources: Source[];
}

export interface Conversation {
  id: string;
  meeting_id: string | null;
  title: string | null;
  created_at: string | null;
}

export interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  sources: Source[] | null;
  created_at: string | null;
}

/** Media captured on this device, ready to upload (see src/recording). */
export interface RecordedMedia {
  uri: string;
  name: string;
  mimeType: string;
  durationMs: number;
  hasVideo: boolean;
  /** Web only: the recorded data, so it does not have to be fetched back from the blob URL. */
  blob?: Blob;
}
