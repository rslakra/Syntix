// Phones use the system's microphone and camera, so there is nothing to pick. See DevicePickers.web.tsx.
import type { CallRecorder } from './types';

export function DevicePickers(_props: { recorder: CallRecorder; disabled?: boolean }) {
  return null;
}
