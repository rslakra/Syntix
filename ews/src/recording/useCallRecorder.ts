// Native (iOS / Android) recorder: expo-audio for audio-only, expo-camera for audio + video.
// The browser version is in useCallRecorder.web.ts.
//
// Phones use the system's microphone and camera, so there are no device lists. The camera view must
// be on screen and ready before it can record; <CallPreview> is that view.
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Camera, type CameraView } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';

import { mimeFromUri, timestampForFilename } from '../utils/format';
import type { RecordedMedia } from '../types';
import { deviceOffMessage, isDeviceAllowed } from './devicePrefs';
import type { CallRecorder, DeviceLists, PermissionState, RecorderState } from './types';

const CAMERA_READY_TIMEOUT_MS = 10_000;
const NO_DEVICES: DeviceLists = { microphones: [], cameras: [], microphoneId: null, cameraId: null };
const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/** expo-audio reports metering in decibels (about -60 for near silence up to 0 for the loudest). */
function levelFromDecibels(decibels: number | undefined): number | null {
  if (decibels === undefined || Number.isNaN(decibels)) return null;
  return Math.max(0, Math.min(1, (decibels + 60) / 60));
}

export function useCallRecorder(): CallRecorder {
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const cameraRef = useRef<CameraView>(null);

  const [state, setStateValue] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [micEnabled, setMicEnabledValue] = useState(true);
  const [cameraEnabled, setCameraEnabledValue] = useState(false);
  const [level, setLevel] = useState<number | null>(null);

  const stateRef = useRef<RecorderState>('idle');
  const startedAt = useRef(0);
  const withVideo = useRef(false);
  const micOn = useRef(true);
  const cameraOn = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoResult = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const cameraReady = useRef(false);
  const cameraWaiter = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);

  const setState = useCallback((next: RecorderState) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);

  const stopTimers = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (levelTimer.current) clearInterval(levelTimer.current);
    timer.current = null;
    levelTimer.current = null;
    setLevel(null);
  }, []);

  useEffect(() => stopTimers, [stopTimers]);

  const onCameraReady = useCallback(() => {
    cameraReady.current = true;
    cameraWaiter.current?.resolve();
    cameraWaiter.current = null;
  }, []);
  const onCameraError = useCallback((message: string) => {
    cameraWaiter.current?.reject(new Error(message));
    cameraWaiter.current = null;
  }, []);
  const onCameraReleased = useCallback(() => {
    cameraReady.current = false;
  }, []);

  const prepare = useCallback(async () => {
    if (!isDeviceAllowed('microphone')) {
      setError(deviceOffMessage('microphone'));
      return false;
    }
    try {
      const microphone = await requestRecordingPermissionsAsync();
      if (!microphone.granted) {
        setPermission('denied');
        setError('Microphone access was denied. Allow it in the system settings to record.');
        return false;
      }
      setPermission('granted');
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, []);

  const setMicEnabled = useCallback(
    (on: boolean) => {
      micOn.current = on;
      setMicEnabledValue(on);
      // Audio only: pausing the recorder is how the microphone is muted. (Video is muted by the camera view.)
      if (stateRef.current === 'recording' && !withVideo.current) {
        if (on) audioRecorder.record();
        else audioRecorder.pause();
      }
    },
    [audioRecorder],
  );

  const setCameraEnabled = useCallback(async (on: boolean) => {
    if (stateRef.current === 'recording') return; // the camera cannot be switched while recording
    if (!on) {
      cameraOn.current = false;
      cameraReady.current = false;
      setCameraEnabledValue(false);
      return;
    }
    if (!isDeviceAllowed('camera')) {
      setError(deviceOffMessage('camera'));
      return;
    }
    const camera = await Camera.requestCameraPermissionsAsync();
    if (!camera.granted) {
      setPermission('denied');
      setError('Camera access was denied. Allow it in the system settings, or record audio only.');
      return;
    }
    setError(null);
    cameraOn.current = true;
    setCameraEnabledValue(true);
  }, []);

  const start = useCallback(async () => {
    if (stateRef.current !== 'idle') return false;
    setError(null);
    setState('starting');
    try {
      if (!isDeviceAllowed('microphone')) throw new Error(deviceOffMessage('microphone'));
      const video = cameraOn.current;
      // Starting swaps the lobby's camera view for the call's: only a "ready" from the new view counts.
      if (video) cameraReady.current = false;
      // These calls show the system permission dialogs the first time.
      const microphone = video
        ? await Camera.requestMicrophonePermissionsAsync()
        : await requestRecordingPermissionsAsync();
      if (!microphone.granted) {
        setPermission('denied');
        throw new Error('Microphone access was denied. Allow it in the system settings to record.');
      }
      setPermission('granted');

      withVideo.current = video;
      if (video) {
        if (!cameraReady.current) {
          // The camera view may have just been mounted: wait for it.
          await new Promise<void>((resolve, reject) => {
            cameraWaiter.current = { resolve, reject };
            setTimeout(() => reject(new Error('The camera did not become ready.')), CAMERA_READY_TIMEOUT_MS);
          });
        }
        const camera = cameraRef.current;
        if (!camera) throw new Error('The camera is not available.');
        videoResult.current = camera.recordAsync();
      } else {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        if (!micOn.current) audioRecorder.pause();
        levelTimer.current = setInterval(() => {
          setLevel(micOn.current ? levelFromDecibels(audioRecorder.getStatus().metering) : 0);
        }, 150);
      }

      startedAt.current = Date.now();
      setElapsedMs(0);
      timer.current = setInterval(() => setElapsedMs(Date.now() - startedAt.current), 500);
      setState('recording');
      return true;
    } catch (e) {
      stopTimers();
      setError(e instanceof Error ? e.message : String(e));
      setState('idle');
      return false;
    }
  }, [audioRecorder, setState, stopTimers]);

  const finish = useCallback(async (): Promise<RecordedMedia | null> => {
    stopTimers();
    const durationMs = Date.now() - startedAt.current;
    const video = withVideo.current;
    let uri: string | null | undefined;
    if (video) {
      cameraRef.current?.stopRecording();
      uri = (await videoResult.current)?.uri;
      videoResult.current = null;
    } else {
      await audioRecorder.stop();
      uri = audioRecorder.uri;
    }
    if (!uri) return null;
    const extension = uri.split('?')[0].split('.').pop() || (video ? 'mp4' : 'm4a');
    return {
      uri,
      name: `meeting-${timestampForFilename()}.${extension}`,
      mimeType: mimeFromUri(uri, video ? 'video/mp4' : 'audio/mp4'),
      durationMs,
      hasVideo: video,
    };
  }, [audioRecorder, stopTimers]);

  const stop = useCallback(async () => {
    if (stateRef.current !== 'recording') return null;
    setState('stopping');
    try {
      const media = await finish();
      if (!media) setError('Nothing was recorded.');
      return media;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      cameraOn.current = false;
      setCameraEnabledValue(false);
      setState('idle');
    }
  }, [finish, setState]);

  const cancel = useCallback(async () => {
    if (stateRef.current === 'recording') {
      setState('stopping');
      try {
        await finish();
      } catch {
        // Discarding anyway.
      }
    }
    stopTimers();
    cameraOn.current = false;
    setCameraEnabledValue(false);
    setState('idle');
  }, [finish, setState, stopTimers]);

  return {
    state,
    elapsedMs,
    error,
    permission,
    preview: {
      video: cameraEnabled,
      stream: null,
      cameraRef,
      mute: !micEnabled,
      onCameraReady,
      onCameraError,
      onCameraReleased,
    },
    micEnabled,
    cameraEnabled,
    // A phone cannot change the sound of a video that is already recording.
    canToggleMic: state !== 'recording' || !withVideo.current,
    canToggleCamera: state !== 'recording',
    level,
    devices: NO_DEVICES,
    prepare,
    setMicEnabled,
    setCameraEnabled,
    selectMicrophone: async () => undefined,
    selectCamera: async () => undefined,
    start,
    stop,
    cancel,
  };
}
