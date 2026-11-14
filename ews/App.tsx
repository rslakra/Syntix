import { Cabin_400Regular } from '@expo-google-fonts/cabin/400Regular';
import { Cabin_500Medium } from '@expo-google-fonts/cabin/500Medium';
import { Cabin_600SemiBold } from '@expo-google-fonts/cabin/600SemiBold';
import { Cabin_700Bold } from '@expo-google-fonts/cabin/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { loadBaseUrl } from './src/api/client';
import { loadDataSource } from './src/api/demo';
import { AppShell, Framed } from './src/components/shell';
import { loadDevicePrefs } from './src/recording/devicePrefs';
import { CallScreen } from './src/screens/CallScreen';
import { MeetingDetailScreen } from './src/screens/MeetingDetailScreen';
import { ScheduleScreen } from './src/screens/ScheduleScreen';
import { colors, createStyles } from './src/theme';
import { NavProvider, useNav } from './src/utils/nav';
import { loadDisplayName } from './src/utils/profile';
import { ThemeProvider, loadThemePreference, useTheme } from './src/utils/theme';

function Router() {
  const { route } = useNav();
  switch (route.name) {
    case 'schedule':
      return (
        <Framed>
          <ScheduleScreen />
        </Framed>
      );
    case 'meeting':
      return (
        <Framed>
          <MeetingDetailScreen key={route.id} meetingId={route.id} />
        </Framed>
      );
    case 'call':
      return <CallScreen key={route.id} meetingId={route.id} />;
    default:
      return <AppShell />;
  }
}

/** Dark icons on a light theme, light icons on a dark one (the call screen sets its own). */
function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [fontsLoaded, fontError] = useFonts({ Cabin_400Regular, Cabin_500Medium, Cabin_600SemiBold, Cabin_700Bold });

  // The saved address, name and theme are read before the first screen, so nothing flashes.
  useEffect(() => {
    Promise.all([loadBaseUrl(), loadDisplayName(), loadThemePreference(), loadDataSource(), loadDevicePrefs()]).finally(() => setLoaded(true));
  }, []);

  // A font that fails to load must not block the app: the system font is used instead.
  const ready = loaded && (fontsLoaded || fontError !== null);

  return (
    <SafeAreaProvider>
      {ready ? (
        <NavProvider>
          <ThemeProvider>
            <ThemedStatusBar />
            <Router />
          </ThemeProvider>
        </NavProvider>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = createStyles(() =>
  StyleSheet.create({
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  }),
);
