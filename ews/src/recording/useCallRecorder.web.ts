// Browser recorder: getUserMedia + MediaRecorder. The browser shows its own permission prompt.
// The native version is in useCallRecorder.ts.
//
// Lifecycle: prepare() opens the devices for the lobby preview (and the level meter); start() records
// that same stream; stop() / cancel() release it.
import { useCallback, useEffect, useRef, useState } from 'react';

import { timestampForFilename } from '../utils/format';
import type { RecordedMedia } from '../types';
import { deviceOffMessage, isDeviceAllowed } from './devicePrefs';
import type { CallRecorder, DeviceLists, PermissionState, RecorderState } from './types';

const noop = () => undefined;

function pickMimeType(video: boolean): string | undefined {
  const candidates = video
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
}

function extensionFor(type: string): string {
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('ogg')) return 'ogg';
  return 'webm';
}

function describeError(error: unknown): { message: string; denied: boolean } {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      denied: true,
      message:
        'Microphone or camera access was blocked. Click the lock icon in the address bar, allow access, then try again.',
    };
  }
  if (name === 'NotFoundError') {
    return { denied: false, message: 'No microphone (or camera) was found on this device.' };
  }
  if (name === 'NotReadableError') {
    return { denied: false, message: 'The microphone or camera is in use by another application.' };
  }
  if (name === 'OverconstrainedError') {
    return { denied: false, message: 'That device is no longer available. Pick another one.' };
  }
  return { denied: false, message: error instanceof Error ? error.message : String(error) };
}

const NO_DEVICES: DeviceLists = { microphones: [], cameras: [], microphoneId: null, cameraId: null };

export function useCallRecorder(): CallRecorder {
  const [state, setStateValue] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabledValue] = useState(true);
  const [cameraEnabled, setCameraEnabledValue] = useState(false);
  const [level, setLevel] = useState<number | null>(null);
  const [devices, setDevices] = useState<DeviceLists>(NO_DEVICES);

  const stateRef = useRef<RecorderState>('idle');
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const withVideo = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micOn = useRef(true);
  const cameraOn = useRef(false);
  const micId = useRef<string | null>(null);
  const cameraId = useRef<string | null>(null);
  const meter = useRef<{ context: AudioContext; timer: ReturnType<typeof setInterval> } | null>(null);

  const setState = useCallback((next: RecorderState) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);

  const stopMeter = useCallback(() => {
    if (meter.current) {
      clearInterval(meter.current.timer);
      void meter.current.context.close().catch(noop);
      meter.current = null;
    }
    setLevel(null);
  }, []);

  /** Measures the microphone: root-mean-square of the waveform, ten times a second. */
  const startMeter = useCallback(
    (media: MediaStream) => {
      stopMeter();
      const AudioContextClass: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass || media.getAudioTracks().length === 0) return;
      const context = new AudioContextClass();
      void context.resume().catch(noop);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(media).connect(analyser); // not connected to the speakers: no echo
      const samples = new Uint8Array(analyser.fftSize);
      const handle = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const value of samples) {
          const centred = (value - 128) / 128;
          sum += centred * centred;
        }
        setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
      }, 100);
      meter.current = { context, timer: handle };
    },
    [stopMeter],
  );

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    stopMeter();
  }, [stopMeter]);

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const pick = (kind: MediaDeviceKind, fallback: string) =>
        all
          .filter((device) => device.kind === kind && device.deviceId)
          .map((device, index) => ({ id: device.deviceId, label: device.label || `${fallback} ${index + 1}` }));
      setDevices({
        microphones: pick('audioinput', 'Microphone'),
        cameras: pick('videoinput', 'Camera'),
        microphoneId: streamRef.current?.getAudioTracks()[0]?.getSettings().deviceId ?? micId.current,
        cameraId: streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId ?? cameraId.current,
      });
    } catch {
      // Device names are a convenience; recording works without them.
    }
  }, []);

  /** Opens the devices. Returns a message when it failed, null on success. */
  const acquire = useCallback(
    async (video: boolean): Promise<string | null> => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        return 'This browser cannot record. Use a current Chrome, Edge, Firefox or Safari on https or localhost.';
      }
      releaseStream();
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: micId.current ? { deviceId: { exact: micId.current } } : true,
          video: video ? (cameraId.current ? { deviceId: { exact: cameraId.current } } : true) : false,
        });
        media.getAudioTracks().forEach((track) => {
          track.enabled = micOn.current;
        });
        streamRef.current = media;
        setStream(media);
        setPermission('granted');
        startMeter(media);
        await refreshDevices();
        return null;
      } catch (e) {
        const { message, denied } = describeError(e);
        if (denied) setPermission('denied');
        return message;
      }
    },
    [refreshDevices, releaseStream, startMeter],
  );

  // Never leave the camera light on after leaving the screen.
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      releaseStream();
    },
    [releaseStream],
  );

  const prepare = useCallback(async () => {
    if (streamRef.current) return true;
    if (!isDeviceAllowed('microphone')) {
      setError(deviceOffMessage('microphone'));
      return false;
    }
    const problem = await acquire(cameraOn.current);
    setError(problem);
    return problem === null;
  }, [acquire]);

  const setMicEnabled = useCallback((on: boolean) => {
    micOn.current = on;
    setMicEnabledValue(on);
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = on;
    });
  }, []);

  const setCameraEnabled = useCallback(
    async (on: boolean) => {
      if (stateRef.current === 'recording') {
        // A recording cannot gain a track: only an existing video track can be switched off and on.
        const track = streamRef.current?.getVideoTracks()[0];
        if (track) {
          track.enabled = on;
          cameraOn.current = on;
          setCameraEnabledValue(on);
        }
        return;
      }
      if (on && !isDeviceAllowed('camera')) {
        setError(deviceOffMessage('camera'));
        return;
      }
      cameraOn.current = on;
      setCameraEnabledValue(on);
      const problem = await acquire(on);
      if (problem && on) {
        // Keep the microphone working when only the camera is the problem.
        cameraOn.current = false;
        setCameraEnabledValue(false);
        setError((await acquire(false)) ?? problem);
        return;
      }
      setError(problem);
    },
    [acquire],
  );

  const selectMicrophone = useCallback(
    async (id: string) => {
      if (stateRef.current === 'recording') return;
      micId.current = id;
      setError(await acquire(cameraOn.current));
    },
    [acquire],
  );

  const selectCamera = useCallback(
    async (id: string) => {
      if (stateRef.current === 'recording') return;
      cameraId.current = id;
      if (cameraOn.current) setError(await acquire(true));
      else setDevices((current) => ({ ...current, cameraId: id }));
    },
    [acquire],
  );

  const start = useCallback(async () => {
    if (stateRef.current !== 'idle') return false;
    setError(null);
    setState('starting');
    if (!streamRef.current && !(await prepare())) {
      setState('idle');
      return false;
    }
    const media = streamRef.current;
    if (!media) {
      setState('idle');
      return false;
    }
    try {
      const video = media.getVideoTracks().length > 0;
      const mimeType = pickMimeType(video);
      const mediaRecorder = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      mediaRecorder.start(1000);
      recorder.current = mediaRecorder;
      withVideo.current = video;
      startedAt.current = Date.now();
      setElapsedMs(0);
      timer.current = setInterval(() => setElapsedMs(Date.now() - startedAt.current), 500);
      setState('recording');
      return true;
    } catch (e) {
      setError(describeError(e).message);
      setState('idle');
      return false;
    }
  }, [prepare, setState]);

  const stop = useCallback(async (): Promise<RecordedMedia | null> => {
    const mediaRecorder = recorder.current;
    if (stateRef.current !== 'recording' || !mediaRecorder) return null;
    setState('stopping');
    const durationMs = Date.now() - startedAt.current;
    const video = withVideo.current;
    return new Promise<RecordedMedia | null>((resolve) => {
      mediaRecorder.onstop = () => {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        releaseStream();
        recorder.current = null;
        setState('idle');
        const type = mediaRecorder.mimeType || (video ? 'video/webm' : 'audio/webm');
        const blob = new Blob(chunks.current, { type });
        if (blob.size === 0) {
          setError('Nothing was recorded.');
          resolve(null);
          return;
        }
        resolve({
          uri: URL.createObjectURL(blob),
          name: `meeting-${timestampForFilename()}.${extensionFor(type)}`,
          mimeType: type.split(';')[0],
          durationMs,
          hasVideo: video,
          blob,
        });
      };
      mediaRecorder.stop();
    });
  }, [releaseStream, setState]);

  const cancel = useCallback(async () => {
    const mediaRecorder = recorder.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = noop;
      mediaRecorder.stop();
    }
    recorder.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    releaseStream();
    setState('idle');
  }, [releaseStream, setState]);

  const videoShown = cameraEnabled && !!stream && stream.getVideoTracks().length > 0;

  return {
    state,
    elapsedMs,
    error,
    permission,
    preview: {
      video: videoShown,
      stream,
      cameraRef: { current: null },
      mute: false,
      onCameraReady: noop,
      onCameraError: noop,
      onCameraReleased: noop,
    },
    micEnabled,
    cameraEnabled,
    canToggleMic: true,
    canToggleCamera: state !== 'recording' || withVideo.current,
    level,
    devices,
    prepare,
    setMicEnabled,
    setCameraEnabled,
    selectMicrophone,
    selectCamera,
    start,
    stop,
    cancel,
  };
}
