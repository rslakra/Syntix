/** The API stores timestamps without a time zone (UTC), so a missing suffix means UTC. */
export function parseServerDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasZone = /([zZ]|[+-]\d\d:?\d\d)$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | null | undefined): string {
  const date = parseServerDate(value);
  if (!date) return '';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 65_000 → "1:05"; 3_725_000 → "1:02:05". */
export function formatDuration(ms: number | null | undefined): string {
  const total = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}` : `${minutes}:${ss}`;
}

export function formatRange(start: number | null | undefined, end: number | null | undefined): string {
  if (start == null) return '';
  return end == null ? formatDuration(start) : `${formatDuration(start)}–${formatDuration(end)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date as "YYYY-MM-DD" for the schedule form. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local time as "HH:MM" for the schedule form. */
export function toTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Combines the form's local date and time; returns null when either is malformed. */
export function parseLocalDateTime(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const result = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  const valid =
    result.getFullYear() === Number(d[1]) &&
    result.getMonth() === Number(d[2]) - 1 &&
    result.getDate() === Number(d[3]) &&
    Number(t[1]) < 24 &&
    Number(t[2]) < 60;
  return valid ? result : null;
}

/**
 * One participant per line or comma-separated. Accepts "Ana", "Ana <ana@x.com>" or "ana@x.com".
 */
export function parseParticipants(text: string): { name: string; email?: string }[] {
  return text
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const withName = /^(.*?)\s*<([^>]+)>$/.exec(part);
      if (withName) return { name: withName[1] || withName[2], email: withName[2] };
      if (part.includes('@') && !part.includes(' ')) return { name: part.split('@')[0], email: part };
      return { name: part };
    });
}

export function mimeFromUri(uri: string, fallback: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4a: 'audio/mp4',
    caf: 'audio/x-caf',
    wav: 'audio/wav',
    '3gp': 'audio/3gpp',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
  };
  return (ext && map[ext]) || fallback;
}

export function timestampForFilename(date = new Date()): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
