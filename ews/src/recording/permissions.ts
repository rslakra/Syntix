// Native microphone / camera permission status (Settings screen). Browser version: permissions.web.ts.
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Camera } from 'expo-camera';

import type { DeviceKind, DevicePermissions, PermissionStatus } from './types';

function toStatus(response: { granted: boolean; status: string }): PermissionStatus {
  if (response.granted) return 'granted';
  return response.status === 'denied' ? 'denied' : 'undetermined';
}

export async function getPermissions(): Promise<DevicePermissions> {
  const [microphone, camera] = await Promise.all([
    getRecordingPermissionsAsync(),
    Camera.getCameraPermissionsAsync(),
  ]);
  return { microphone: toStatus(microphone), camera: toStatus(camera) };
}

/**
 * Shows the system dialog for one device and returns the new status of both. The system only asks
 * once: after a "no" it answers `denied` straight away, and only the system settings can change it.
 */
export async function requestPermission(kind: DeviceKind): Promise<DevicePermissions> {
  if (kind === 'microphone') await requestRecordingPermissionsAsync();
  else await Camera.requestCameraPermissionsAsync();
  return getPermissions();
}

/** Phones have a system settings page for the app; browsers do not offer one to a page. */
export const canOpenSystemSettings = true;
