import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';

import { api, errorMessage, getBaseUrl, getDefaultBaseUrl, saveBaseUrl } from '../api/client';
import { getDataSource, saveDataSource, type DataSource } from '../api/demo';
import { Button, Card, Chip, ErrorBanner, Field, Muted, Screen, SectionTitle } from '../components/ui';
import { useLogOut } from '../hooks/useLogOut';
import { getDevicePrefs, setDevicePref } from '../recording/devicePrefs';
import { canOpenSystemSettings, getPermissions, requestPermission } from '../recording/permissions';
import type { DeviceKind, DevicePermissions } from '../recording/types';
import { colors, createStyles, space } from '../theme';
import { getDisplayName, saveDisplayName } from '../utils/profile';
import { useTheme, type ThemePreference } from '../utils/theme';

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System Default' },
];

const SOURCES: { id: DataSource; label: string; help: string }[] = [
  { id: 'auto', label: 'Automatic', help: 'Your meetings from the API. Demo data while the API cannot be reached or has no meetings yet.' },
  { id: 'live', label: 'Live API only', help: 'Only the API. Errors and empty lists are shown as they are.' },
  { id: 'demo', label: 'Demo data', help: 'Always the built-in demo meetings, even when the API is up. Nothing is sent to the API.' },
];

export function SettingsScreen() {
  const { preference, setPreference, reload } = useTheme();
  const logOut = useLogOut();
  const [source, setSource] = useState<DataSource>(getDataSource());
  const [name, setName] = useState(getDisplayName());
  const [nameSaved, setNameSaved] = useState(false);
  const [url, setUrl] = useState(getBaseUrl());
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [permissions, setPermissions] = useState<DevicePermissions | null>(null);
  const [devices, setDevices] = useState(getDevicePrefs());
  const [error, setError] = useState<string | null>(null);

  const refreshPermissions = useCallback(async () => {
    try {
      setPermissions(await getPermissions());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    refreshPermissions();
    // Coming back from the system settings (or another browser tab): read the status again.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermissions();
    });
    return () => subscription.remove();
  }, [refreshPermissions]);

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      await saveBaseUrl(url);
      const health = await api.health();
      setResult({ ok: true, text: `Connected to "${health.app}" (${health.env}).` });
    } catch (e) {
      setResult({ ok: false, text: errorMessage(e) });
    } finally {
      setTesting(false);
    }
  };

  /**
   * Ticking allows Syntix to use the device and, if the system has not been asked yet, asks it; if it
   * was already refused, the system will not ask again, so a phone opens its settings (and the web
   * row explains the lock icon). Unticking stops Syntix from using the device: an app cannot take a
   * permission back from the system, so that part stays in the system settings.
   */
  const toggleDevice = async (kind: DeviceKind) => {
    const status = permissions?.[kind];
    const on = devices[kind] && status === 'granted';
    try {
      await setDevicePref(kind, !on);
      setDevices(getDevicePrefs());
      if (on) return;
      if (status === 'denied') {
        if (canOpenSystemSettings) await Linking.openSettings();
      } else if (status !== 'granted') {
        setPermissions(await requestPermission(kind));
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen title="Settings" bottomInset={false}>
      <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <Card>
          <SectionTitle>You</SectionTitle>
          <Field
            label="Your name (shown on your tile when you start a meeting)"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setNameSaved(false);
            }}
            autoCapitalize="words"
            maxLength={40}
          />
          <Button
            title={nameSaved ? 'Saved' : 'Save name'}
            variant="secondary"
            disabled={nameSaved}
            onPress={async () => {
              await saveDisplayName(name);
              setName(getDisplayName());
              setNameSaved(true);
            }}
          />
        </Card>

        <Card>
          <SectionTitle>Appearance</SectionTitle>
          <View style={styles.themes}>
            {THEMES.map((theme) => (
              <Chip key={theme.id} label={theme.label} selected={preference === theme.id} onPress={() => setPreference(theme.id)} />
            ))}
          </View>
          <View style={{ marginTop: space.md }}>
            <Muted>Your choice is remembered on this device. "System Default" follows its light or dark setting.</Muted>
          </View>
        </Card>

        <Card>
          <SectionTitle>Data source</SectionTitle>
          <View style={styles.themes}>
            {SOURCES.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={source === item.id}
                onPress={async () => {
                  await saveDataSource(item.id);
                  setSource(item.id);
                  reload(); // every screen loads its data again from the new source
                }}
              />
            ))}
          </View>
          <View style={{ marginTop: space.md }}>
            <Muted>{SOURCES.find((item) => item.id === source)?.help}</Muted>
          </View>
        </Card>

        <Card>
          <SectionTitle>Syntix API</SectionTitle>
          <Field
            label="Server address"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder={getDefaultBaseUrl()}
          />
          <Button title="Save and test connection" onPress={test} loading={testing} />
          {result ? (
            <Text style={[styles.result, { color: result.ok ? colors.success : colors.danger }]}>{result.text}</Text>
          ) : null}
          <View style={{ marginTop: space.md }}>
            <Muted>
              Simulator or browser on the same computer: http://localhost:8080. Android emulator: http://10.0.2.2:8080. A
              real phone: http://&lt;your computer's LAN address&gt;:8080 (and add the app's origin to CORS_ORIGINS if you
              use the browser).
            </Muted>
          </View>
        </Card>

        <Card>
          <SectionTitle>Microphone and camera</SectionTitle>
          <PermissionCheckbox
            label="Microphone"
            kind="microphone"
            enabled={devices.microphone}
            status={permissions?.microphone}
            onToggle={toggleDevice}
          />
          <PermissionCheckbox
            label="Camera (only for video)"
            kind="camera"
            enabled={devices.camera}
            status={permissions?.camera}
            onToggle={toggleDevice}
          />
          <View style={{ marginTop: space.md }}>
            <Muted>
              {Platform.OS === 'web'
                ? 'Tick a box to let Syntix use that device (your browser asks the first time); untick it to stop Syntix using it. The browser keeps its own answer for this site: if it says Blocked, change it with the lock icon in the address bar, then reload. Recording works on localhost or https only.'
                : 'Tick a box to let Syntix use that device (the system asks the first time); untick it to stop Syntix using it. If the system says Blocked, ticking opens its settings, because it will not ask again. To take a permission away from the system itself, use the system settings.'}
            </Muted>
          </View>
        </Card>

        <Card>
          <SectionTitle>Privacy</SectionTitle>
          <Muted>
            Recordings go only to the Syntix server above, where they are transcribed and answered by models running on
            your own machine. Nothing is sent to a cloud service. Always tell participants before you record them.
          </Muted>
        </Card>

        <Card>
          <SectionTitle>Account</SectionTitle>
          <Muted>There is no sign-in yet. Logging out only forgets your name on this device.</Muted>
          <Button title="Log out" variant="secondary" onPress={logOut} style={{ marginTop: space.md }} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

/**
 * A checkbox for one device. It is ticked when Syntix may use it and the system or browser allows it;
 * the line under the label says which of the two is missing.
 */
function PermissionCheckbox({
  label,
  kind,
  enabled,
  status,
  onToggle,
}: {
  label: string;
  kind: DeviceKind;
  /** Syntix's own switch for this device. */
  enabled: boolean;
  /** What the system or browser says. */
  status?: 'granted' | 'denied' | 'undetermined';
  onToggle: (kind: DeviceKind) => void;
}) {
  const checked = enabled && status === 'granted';
  let text = 'Checking…';
  let color: string = colors.muted;
  if (!enabled) {
    text = 'Off: Syntix will not use it';
  } else if (status === 'granted') {
    text = 'Allowed';
    color = colors.success;
  } else if (status === 'denied') {
    text = canOpenSystemSettings
      ? 'Blocked by the system: tick to open its settings'
      : 'Blocked by the browser: use the lock icon in the address bar, then reload';
    color = colors.danger;
  } else if (status === 'undetermined') {
    text = 'Not asked yet: tick the box to allow it';
  }
  return (
    <Pressable
      onPress={() => onToggle(kind)}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      aria-checked={checked}
      style={styles.permission}
    >
      <MaterialIcons name={checked ? 'check-box' : 'check-box-outline-blank'} size={26} color={checked ? colors.primary : colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.permissionLabel}>{label}</Text>
        <Text style={[styles.permissionStatus, { color }]}>{text}</Text>
      </View>
    </Pressable>
  );
}

const styles = createStyles(() => StyleSheet.create({
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  result: { marginTop: space.md, fontSize: 14 },
  permission: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  permissionLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  permissionStatus: { fontSize: 13, marginTop: 2 },
}));
