import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  useWindowDimensions,
} from 'react-native';
import { Text } from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, errorMessage } from '../api/client';
import { Avatar, LevelMeter, RoundButton } from '../components/CallControls';
import { Button, Card, ErrorBanner, Muted, Screen } from '../components/ui';
import { CallPreview } from '../recording/CallPreview';
import { DevicePickers } from '../recording/DevicePickers';
import type { CallRecorder } from '../recording/types';
import { useCallRecorder } from '../recording/useCallRecorder';
import { colors, createStyles, space } from '../theme';
import type { MeetingDetail, RecordedMedia } from '../types';
import { confirm } from '../utils/dialog';
import { formatDuration } from '../utils/format';
import { useNav } from '../utils/nav';
import { getDisplayName } from '../utils/profile';

type Phase = 'setup' | 'live' | 'saving' | 'failed';

const QUIET_LEVEL = 0.03; // below this the microphone is effectively silent
const QUIET_AFTER_MS = 5000;

/**
 * Start a meeting, in two steps like a video call:
 *  1. the lobby: a live preview, microphone and camera switches, device pickers and the recording consent;
 *  2. the call: a full-screen view with the controls, while the meeting is recorded.
 * Ending the call uploads the file and starts the server-side pipeline (transcribe → … → index).
 */
export function CallScreen({ meetingId }: { meetingId: string }) {
  const nav = useNav();
  const recorder = useCallRecorder();
  const name = getDisplayName();

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>('setup');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<RecordedMedia | null>(null);
  const [quiet, setQuiet] = useState(false);

  useEffect(() => {
    api
      .getMeeting(meetingId)
      .then(setMeeting)
      .catch((e) => setError(errorMessage(e)));
  }, [meetingId]);

  // Open the devices for the lobby preview, which also asks for permission, as soon as the screen opens.
  useEffect(() => {
    void recorder.prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  // Tell the user when nothing is coming through the microphone, which a silent recording would hide.
  const levelRef = useRef<number | null>(null);
  const micRef = useRef(true);
  levelRef.current = recorder.level;
  micRef.current = recorder.micEnabled;
  useEffect(() => {
    if (phase !== 'live') {
      setQuiet(false);
      return;
    }
    let since: number | null = null;
    const timer = setInterval(() => {
      const level = levelRef.current;
      const silent = micRef.current && level !== null && level < QUIET_LEVEL;
      if (!silent) {
        since = null;
        setQuiet(false);
        return;
      }
      since ??= Date.now();
      setQuiet(Date.now() - since > QUIET_AFTER_MS);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const begin = async () => {
    setError(null);
    try {
      // Mark the meeting as started first, so an unreachable server is reported before recording.
      await api.updateMeeting(meetingId, { started_at: new Date().toISOString(), ended_at: null });
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    // Show the call first: on phones the camera view in the call is the one that records.
    setPhase('live');
    if (!(await recorder.start())) setPhase('setup');
  };

  const upload = async (media: RecordedMedia) => {
    setPhase('saving');
    setError(null);
    try {
      setProgress('Saving the meeting…');
      await api.updateMeeting(meetingId, { ended_at: new Date().toISOString() });
      setProgress('Uploading the recording…');
      await api.uploadRecording(meetingId, media);
      setPending(null);
      setProgress('Starting transcription…');
      await api.processMeeting(meetingId);
      nav.replace({ name: 'meeting', id: meetingId });
    } catch (e) {
      setError(errorMessage(e));
      setPhase('failed');
    }
  };

  const end = async () => {
    const media = await recorder.stop();
    if (!media) {
      setError(recorder.error ?? 'Nothing was recorded.');
      setPhase('failed');
      return;
    }
    setPending(media);
    setProgress('Finishing the recording…');
    await upload(media);
  };

  const leave = async () => {
    if (phase === 'live') {
      const ok = await confirm('Discard this recording?', 'The recording in progress will be lost.', 'Discard');
      if (!ok) return;
    }
    await recorder.cancel(); // also releases the camera and microphone opened for the preview
    nav.pop();
  };

  const addFileInstead = async () => {
    await recorder.cancel();
    nav.replace({ name: 'meeting', id: meetingId });
  };

  // Android's back button: confirm before dropping a live recording, ignore it while saving.
  // Registered after the navigator's own handler, so it runs first.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'live') {
        void leave();
        return true;
      }
      return phase === 'saving';
    });
    return () => subscription.remove();
  });

  if (phase === 'live') {
    return (
      <InCall
        recorder={recorder}
        meeting={meeting}
        name={name}
        quiet={quiet}
        error={error ?? recorder.error}
        onDismissError={() => setError(null)}
        onEnd={end}
      />
    );
  }

  return (
    <Screen title="Ready to start?" onBack={phase === 'saving' ? undefined : leave}>
      {phase === 'setup' ? (
        <Lobby
          recorder={recorder}
          meeting={meeting}
          name={name}
          consent={consent}
          onConsent={setConsent}
          starting={recorder.state === 'starting'}
          error={error ?? recorder.error}
          onDismissError={() => setError(null)}
          onStart={begin}
          onAddFile={addFileInstead}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />

          {phase === 'saving' ? (
            <Card>
              <Text style={styles.savingTitle}>{progress}</Text>
              <Muted>Keep this screen open until it finishes.</Muted>
            </Card>
          ) : null}

          {phase === 'failed' ? (
            <Card>
              <Text style={styles.savingTitle}>{pending ? 'The recording was not uploaded' : 'Something went wrong'}</Text>
              <Muted>
                {pending
                  ? 'Your recording is still on this device. Fix the problem (is the API running?) and retry.'
                  : 'The recording was saved. You can open the meeting and process it from there.'}
              </Muted>
              <View style={{ gap: space.sm, marginTop: space.md }}>
                {pending ? <Button title="Retry upload" onPress={() => upload(pending)} /> : null}
                <Button
                  title="Open meeting"
                  variant="secondary"
                  onPress={() => nav.replace({ name: 'meeting', id: meetingId })}
                />
                {pending ? (
                  <Button
                    title="Discard recording"
                    variant="ghost"
                    onPress={async () => {
                      if (await confirm('Discard the recording?', 'It has not been uploaded and will be lost.', 'Discard')) {
                        setPending(null);
                        nav.replace({ name: 'meeting', id: meetingId });
                      }
                    }}
                  />
                ) : null}
              </View>
            </Card>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

// --- the lobby ----------------------------------------------------------------------------------

function Lobby({
  recorder,
  meeting,
  name,
  consent,
  onConsent,
  starting,
  error,
  onDismissError,
  onStart,
  onAddFile,
}: {
  recorder: CallRecorder;
  meeting: MeetingDetail | null;
  name: string;
  consent: boolean;
  onConsent: (value: boolean) => void;
  starting: boolean;
  error: string | null;
  onDismissError: () => void;
  onStart: () => void;
  onAddFile: () => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 880;
  const blocked = recorder.permission === 'denied';
  const invited = meeting?.participants.map((p) => p.name).join(', ');

  return (
    <ScrollView contentContainerStyle={[styles.lobby, wide && styles.lobbyWide]} keyboardShouldPersistTaps="handled">
      <View style={wide ? styles.lobbyLeft : undefined}>
        <View style={styles.tile}>
          <CallPreview preview={recorder.preview} />
          {!recorder.preview.video ? (
            <Text style={styles.tileMessage}>{blocked ? 'Microphone access is blocked' : 'Camera is off'}</Text>
          ) : null}
          <Text style={styles.tileName} numberOfLines={1}>
            {name}
          </Text>
          <LevelMeter level={recorder.micEnabled ? recorder.level : 0} style={styles.tileLevel} />
          <View style={styles.tileControls}>
            <RoundButton
              tone="light"
              icon={recorder.micEnabled ? 'mic' : 'mic-off'}
              label={recorder.micEnabled ? 'Turn off microphone' : 'Turn on microphone'}
              off={!recorder.micEnabled}
              disabled={!recorder.canToggleMic}
              onPress={() => recorder.setMicEnabled(!recorder.micEnabled)}
            />
            <RoundButton
              tone="light"
              icon={recorder.cameraEnabled ? 'videocam' : 'videocam-off'}
              label={recorder.cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
              off={!recorder.cameraEnabled}
              disabled={!recorder.canToggleCamera}
              onPress={() => void recorder.setCameraEnabled(!recorder.cameraEnabled)}
            />
          </View>
        </View>
        <DevicePickers recorder={recorder} />
      </View>

      <View style={[styles.panel, wide && styles.lobbyRight]}>
        <Text style={styles.panelTitle}>{meeting?.title ?? 'Meeting'}</Text>
        <Text style={styles.panelSub}>{invited ? `Invited: ${invited}` : 'No one else is invited'}</Text>

        <ErrorBanner message={error} onDismiss={onDismissError} />

        {blocked ? (
          <Card style={[styles.panelCard, { borderColor: colors.danger }]}>
            <Text style={[styles.cardTitle, { color: colors.danger }]}>Access is blocked</Text>
            <Muted>
              {Platform.OS === 'web'
                ? 'Allow the microphone (and camera) for this site in your browser, then reload the preview.'
                : 'Allow the microphone (and camera) for Syntix in your device settings, then try again.'}
            </Muted>
            <View style={{ gap: space.sm, marginTop: space.md }}>
              <Button title="Try again" variant="secondary" onPress={() => void recorder.prepare()} />
              {Platform.OS !== 'web' ? (
                <Button title="Open settings" variant="ghost" onPress={() => Linking.openSettings()} />
              ) : null}
            </View>
          </Card>
        ) : null}

        <Card style={[styles.panelCard, consent ? { borderColor: colors.primary } : undefined]}>
          <View style={styles.switchRow}>
            <MaterialIcons name="fiber-manual-record" size={22} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Everyone has agreed to be recorded</Text>
              <Muted>
                Syntix records with your microphone{recorder.cameraEnabled ? ' and camera' : ''} and sends the file only
                to your own server. Tell every participant before you start.
              </Muted>
            </View>
            <Switch value={consent} onValueChange={onConsent} />
          </View>
        </Card>

        <Button title="Start" onPress={onStart} disabled={!consent} loading={starting} style={styles.startButton} />
        <Button title="Add a file or transcript instead" variant="secondary" onPress={onAddFile} style={styles.otherButton} />
      </View>
    </ScrollView>
  );
}

// --- the call -----------------------------------------------------------------------------------

function useClock(): Date {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function InCall({
  recorder,
  meeting,
  name,
  quiet,
  error,
  onDismissError,
  onEnd,
}: {
  recorder: CallRecorder;
  meeting: MeetingDetail | null;
  name: string;
  quiet: boolean;
  error: string | null;
  onDismissError: () => void;
  onEnd: () => void;
}) {
  const insets = useSafeAreaInsets();
  const now = useClock();
  const people = (meeting?.participants.length ?? 0) + 1;
  const recording = recorder.state === 'recording';
  const showVideo = recorder.preview.video && recorder.cameraEnabled;

  return (
    <View style={[styles.call, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="light" />

      <View style={styles.callHeader}>
        <Text style={styles.callTime}>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
        <Text style={styles.callDivider}>|</Text>
        <Text style={styles.callTitle} numberOfLines={1}>
          {meeting?.title ?? 'Meeting'}
        </Text>
        <View style={{ flex: 1 }} />
        <View style={styles.people} accessibilityLabel={`${people} in this meeting`}>
          <Avatar name={name} size={28} />
          <Text style={styles.peopleCount}>{people}</Text>
        </View>
      </View>

      {quiet ? (
        <View style={styles.notice}>
          <MaterialIcons name="mic-none" size={20} color="#fde68a" />
          <Text style={styles.noticeText}>
            We can't hear anything. Check that the right microphone is selected and not muted.
          </Text>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.notice, { backgroundColor: '#5b1a17' }]}>
          <Text style={styles.noticeText} onPress={onDismissError}>
            {error}
          </Text>
        </View>
      ) : null}

      <View style={styles.callTileWrap}>
        <View style={styles.callTile}>
          {/* contain: the whole picture, never cropped to the shape of the window */}
          <CallPreview preview={recorder.preview} fit="contain" />
          {!showVideo ? <Avatar name={name} size={140} /> : null}
          <Text style={styles.callTileName} numberOfLines={1}>
            {name}
          </Text>
          {!recorder.micEnabled ? (
            <View style={styles.mutedBadge}>
              <MaterialIcons name="mic-off" size={18} color="#ffffff" />
            </View>
          ) : null}
          <LevelMeter level={recorder.micEnabled ? recorder.level : 0} style={styles.callTileLevel} />
        </View>
      </View>

      <View style={styles.callFooter}>
        <RecordingPill starting={recorder.state === 'starting'} elapsedMs={recorder.elapsedMs} />
        <View style={styles.controlBar}>
          <RoundButton
            icon={recorder.micEnabled ? 'mic' : 'mic-off'}
            label={recorder.micEnabled ? 'Mute microphone' : 'Unmute microphone'}
            off={!recorder.micEnabled}
            disabled={!recorder.canToggleMic}
            onPress={() => recorder.setMicEnabled(!recorder.micEnabled)}
          />
          <RoundButton
            icon={recorder.cameraEnabled ? 'videocam' : 'videocam-off'}
            label={recorder.cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
            off={!recorder.cameraEnabled}
            disabled={!recorder.canToggleCamera}
            onPress={() => void recorder.setCameraEnabled(!recorder.cameraEnabled)}
          />
          <RoundButton
            icon="call-end"
            label="End meeting and save"
            danger
            wide
            disabled={!recording}
            onPress={onEnd}
          />
        </View>
        <Text style={styles.callHint}>
          Ending the meeting uploads the recording to your Syntix server, which transcribes it and writes the summary.
        </Text>
      </View>
    </View>
  );
}

function RecordingPill({ starting, elapsedMs }: { starting: boolean; elapsedMs: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.pill}>
      <Animated.View style={[styles.dot, { opacity: pulse }]} />
      <Text style={styles.pillText}>{starting ? 'Starting…' : 'Recording'}</Text>
      {!starting ? <Text style={styles.pillTime}>{formatDuration(elapsedMs)}</Text> : null}
    </View>
  );
}

const DARK = '#101214';
const SURFACE = '#202124';

const styles = createStyles(() => StyleSheet.create({
  // saving / failed cards
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: space.xs },
  savingTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: space.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },

  // lobby
  lobby: { padding: space.lg, gap: space.xl },
  lobbyWide: { flexDirection: 'row', alignItems: 'center', maxWidth: 1180, width: '100%', alignSelf: 'center' },
  lobbyLeft: { flex: 3, minWidth: 0 },
  lobbyRight: { flex: 2, minWidth: 0 },
  tile: {
    aspectRatio: 16 / 9,
    minHeight: 220,
    backgroundColor: SURFACE,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMessage: { color: '#ffffff', fontSize: 22, textAlign: 'center', paddingHorizontal: space.lg },
  tileName: { position: 'absolute', top: 16, left: 20, right: 20, color: '#ffffff', fontSize: 16, fontWeight: '500' },
  tileLevel: { position: 'absolute', bottom: 22, left: 20 },
  tileControls: { position: 'absolute', bottom: 16, flexDirection: 'row', gap: space.md },
  panel: { gap: space.md },
  panelTitle: { fontSize: 30, fontWeight: '400', color: colors.text, textAlign: 'center' },
  panelSub: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  panelCard: { marginBottom: 0 },
  startButton: { minHeight: 56, borderRadius: 999 },
  otherButton: { borderRadius: 999 },

  // call
  call: { flex: 1, backgroundColor: DARK, paddingHorizontal: space.lg },
  callHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  callTime: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  callDivider: { color: '#5f6368', fontSize: 16 },
  callTitle: { color: '#ffffff', fontSize: 16, flexShrink: 1 },
  people: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: SURFACE,
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 12,
  },
  peopleCount: { color: '#ffffff', fontSize: 14 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: '#4a3b0c',
    borderRadius: 12,
    padding: space.md,
    marginBottom: space.md,
  },
  noticeText: { color: '#ffffff', fontSize: 14, flex: 1 },
  callTileWrap: { flex: 1, minHeight: 0, width: '100%', maxWidth: 1180, alignSelf: 'center' },
  callTile: {
    flex: 1,
    backgroundColor: '#2b5c57',
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callTileName: { position: 'absolute', bottom: 16, left: 20, right: 120, color: '#ffffff', fontSize: 16, fontWeight: '500' },
  callTileLevel: { position: 'absolute', bottom: 16, right: 20 },
  mutedBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callFooter: { alignItems: 'center', gap: space.md, paddingTop: space.lg },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: SURFACE,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  callHint: { color: '#9aa0a6', fontSize: 12, textAlign: 'center', maxWidth: 420 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: SURFACE,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ea4335' },
  pillText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  pillTime: { color: '#ffffff', fontSize: 14, fontVariant: ['tabular-nums'] },
}));
