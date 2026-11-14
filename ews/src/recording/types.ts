import type { RefObject } from 'react';

import type { RecordedMedia } from '../types';

export type RecorderState = 'idle' | 'starting' | 'recording' | 'stopping';
export type PermissionState = 'unknown' | 'granted' | 'denied';

export interface MediaDeviceOption {
  id: string;
  label: string;
}

/** Input devices the browser can offer. Always empty on phones, which use the system's choice. */
export interface DeviceLists {
  microphones: MediaDeviceOption[];
  cameras: MediaDeviceOption[];
  microphoneId: string | null;
  cameraId: string | null;
}

/** What <CallPreview> needs to show the camera; each platform fills in the fields it uses. */
export interface PreviewProps {
  /** True while the camera is wanted: shown in the lobby and in the call, and recorded. */
  video: boolean;
  /** Web: the live camera stream. */
  stream: MediaStream | null;
  /** Native: handle of the <CameraView> that records. */
  cameraRef: RefObject<any>;
  /** Native: record the video without sound. */
  mute: boolean;
  onCameraReady: () => void;
  onCameraError: (message: string) => void;
  /** Native: the camera view went away, so it must become ready again before it can record. */
  onCameraReleased: () => void;
}

export interface CallRecorder {
  state: RecorderState;
  elapsedMs: number;
  /** Last problem, in words the user can act on (denied permission, no device, …). */
  error: string | null;
  permission: PermissionState;
  preview: PreviewProps;

  micEnabled: boolean;
  cameraEnabled: boolean;
  /** False when the microphone cannot be switched right now (a phone recording video). */
  canToggleMic: boolean;
  /** False when the camera cannot be switched right now (during a call that began without video, or on a phone). */
  canToggleCamera: boolean;
  /** Microphone level from 0 to 1, or null when it cannot be measured. */
  level: number | null;
  devices: DeviceLists;

  /** Asks for microphone access and opens the devices for the lobby preview. Safe to call again. */
  prepare: () => Promise<boolean>;
  setMicEnabled: (on: boolean) => void;
  setCameraEnabled: (on: boolean) => Promise<void>;
  selectMicrophone: (id: string) => Promise<void>;
  selectCamera: (id: string) => Promise<void>;
  /** Starts recording with the current microphone / camera choice. False if it could not. */
  start: () => Promise<boolean>;
  /** Stops and returns the captured file. */
  stop: () => Promise<RecordedMedia | null>;
  /** Stops, throws any recording away and releases the devices. */
  cancel: () => Promise<void>;
}

export type DeviceKind = 'microphone' | 'camera';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface DevicePermissions {
  microphone: PermissionStatus;
  camera: PermissionStatus;
}
