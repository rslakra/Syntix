// Dashboard numbers, computed on the device from the meeting list (GET /meetings).
import { IN_PROGRESS, type Meeting } from '../types';
import { parseServerDate } from './format';

/** The day a meeting is about: when it is scheduled, else when it started, else when it was created. */
export function meetingDate(meeting: Meeting): Date | null {
  return parseServerDate(meeting.scheduled_at ?? meeting.started_at ?? meeting.created_at);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export interface Stats {
  total: number;
  ready: number;
  failed: number;
  inProgress: number;
  /** Meetings with a recording or transcript (everything past "scheduled"). */
  captured: number;
  readyPct: number;
  capturedPct: number;
  failedPct: number;
  /** Ready against failed only, ignoring meetings that have not been processed. */
  successPct: number;
}

export function computeStats(meetings: Meeting[]): Stats {
  const total = meetings.length;
  const ready = meetings.filter((m) => m.status === 'READY').length;
  const failed = meetings.filter((m) => m.status === 'FAILED').length;
  const inProgress = meetings.filter((m) => IN_PROGRESS.includes(m.status)).length;
  const captured = meetings.filter((m) => m.status !== 'CREATED').length;
  return {
    total,
    ready,
    failed,
    inProgress,
    captured,
    readyPct: percent(ready, total),
    capturedPct: percent(captured, total),
    failedPct: percent(failed, total),
    successPct: percent(ready, ready + failed),
  };
}

export interface MonthlySeries {
  labels: string[];
  total: number[];
  ready: number[];
  /** The latest month, for the card's subtitle. */
  period: string;
}

/** Meetings per month for the last twelve months, all of them and the ones that are ready. */
export function monthlySeries(meetings: Meeting[], now = new Date()): MonthlySeries {
  const months = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - (11 - index), 1));
  const key = (date: Date) => date.getFullYear() * 12 + date.getMonth();
  const slots = new Map(months.map((month, index) => [key(month), index]));
  const total = months.map(() => 0);
  const ready = months.map(() => 0);
  for (const meeting of meetings) {
    const date = meetingDate(meeting);
    const slot = date ? slots.get(key(date)) : undefined;
    if (slot === undefined) continue;
    total[slot] += 1;
    if (meeting.status === 'READY') ready[slot] += 1;
  }
  return {
    labels: months.map((month) => month.toLocaleString(undefined, { month: 'short' })),
    total,
    ready,
    period: now.toLocaleString(undefined, { month: 'short', year: 'numeric' }),
  };
}

/** Meetings on one day, earliest first. */
export function meetingsOnDay(meetings: Meeting[], day: Date): Meeting[] {
  return meetings
    .map((meeting) => ({ meeting, date: meetingDate(meeting) }))
    .filter((entry): entry is { meeting: Meeting; date: Date } => entry.date !== null && sameDay(entry.date, day))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((entry) => entry.meeting);
}

export interface Notice {
  id: string;
  meetingId: string;
  kind: 'ready' | 'failed';
  text: string;
  at: Date | null;
}

/** Recent processing results: what finished, and what needs attention. */
export function notifications(meetings: Meeting[], limit = 6): Notice[] {
  return meetings
    .filter((m) => m.status === 'READY' || m.status === 'FAILED')
    .map((m) => ({ m, at: parseServerDate(m.updated_at ?? m.created_at) }))
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
    .slice(0, limit)
    .map(({ m, at }) => ({
      id: m.id,
      meetingId: m.id,
      kind: m.status === 'READY' ? ('ready' as const) : ('failed' as const),
      text: m.status === 'READY' ? `"${m.title}" is ready — ask Syntix about it` : `"${m.title}" failed: ${m.error_message ?? 'see the meeting'}`,
      at,
    }));
}

/** "08 am", "12 pm" — the hour labels of the timeline. */
export function hourLabel(hour: number): string {
  return `${String(hour % 12 || 12).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
}
