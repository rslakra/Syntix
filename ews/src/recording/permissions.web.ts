// Browser microphone / camera permission status (Settings screen). Native version: permissions.ts.
import type { DeviceKind, DevicePermissions, PermissionStatus } from './types';

async function query(name: DeviceKind): Promise<PermissionStatus> {
  try {
    const result = await navigator.permissions.query({ name: name as PermissionName });
    if (result.state === 'granted') return 'granted';
    return result.state === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined'; // Not every browser can answer this query.
  }
}

export async function getPermissions(): Promise<DevicePermissions> {
  const [microphone, camera] = await Promise.all([query('microphone'), query('camera')]);
  return { microphone, camera };
}

/**
 * Opens the browser's own prompt for one device, then releases the device again, and returns the new
 * status of both. A page cannot undo or re-ask a "block": only the lock icon in the address bar can.
 */
export async function requestPermission(kind: DeviceKind): Promise<DevicePermissions> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(kind === 'microphone' ? { audio: true } : { video: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    // Denied or no such device: the real status is read below.
  }
  return getPermissions();
}

export const canOpenSystemSettings = false;
