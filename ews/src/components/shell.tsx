import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AskScreen } from '../screens/AskScreen';
import { ContactsScreen } from '../screens/ContactsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MeetingsScreen } from '../screens/MeetingsScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TrendsScreen } from '../screens/TrendsScreen';
import { useLogOut } from '../hooks/useLogOut';
import { colors, createStyles, shadow } from '../theme';
import { useNav, type Tab } from '../utils/nav';
import { useTheme } from '../utils/theme';
import { Text } from './Text';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface TabItem {
  id: Tab;
  label: string;
  icon: IconName;
}

const MAIN_TABS: TabItem[] = [
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'home', label: 'Dashboard', icon: 'dashboard' },
  { id: 'reports', label: 'Reports', icon: 'bar-chart' },
  { id: 'trends', label: 'Trends', icon: 'show-chart' },
  { id: 'contacts', label: 'Contacts', icon: 'people-outline' },
  { id: 'ask', label: 'Syntix', icon: 'chat-bubble-outline' },
  { id: 'meetings', label: 'Meetings', icon: 'work-outline' },
];
const SETTINGS_TAB: TabItem = { id: 'settings', label: 'Settings', icon: 'settings' };

/** Screens wider than this get the sidebar inside a rounded panel; narrower ones a bottom bar. */
const WIDE = 900;

export function Logo({ size = 44 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialIcons name="forum" size={size * 0.85} color={colors.primary} />
      <View style={[styles.logoDot, { right: size * 0.1, top: size * 0.12 }]} />
    </View>
  );
}

function content(tab: Tab) {
  switch (tab) {
    case 'search':
      return <SearchScreen />;
    case 'reports':
      return <ReportsScreen />;
    case 'trends':
      return <TrendsScreen />;
    case 'contacts':
      return <ContactsScreen />;
    case 'meetings':
      return <MeetingsScreen />;
    case 'ask':
      return <AskScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <DashboardScreen />;
  }
}

/** The rounded panel on a backdrop, without the sidebar: for screens pushed on top of the tabs. */
export function Framed({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  if (width < WIDE) return <View style={{ flex: 1, backgroundColor: colors.bg }}>{children}</View>;
  return (
    <View style={styles.frame}>
      <View style={[styles.panel, { flexDirection: 'column' }]}>{children}</View>
    </View>
  );
}

function SidebarButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      style={[styles.sidebarItem, active && styles.sidebarItemActive]}
    >
      <MaterialIcons name={icon} size={24} color={active ? '#ffffff' : colors.muted} />
    </Pressable>
  );
}

/** The sun / moon pair at the foot of the sidebar. */
function ThemeSwitch() {
  const { mode, setPreference } = useTheme();
  return (
    <View style={styles.themeSwitch}>
      <Pressable
        onPress={() => setPreference('light')}
        accessibilityRole="button"
        accessibilityLabel="Light theme"
        accessibilityState={{ selected: mode === 'light' }}
        style={[styles.themeButton, mode === 'light' && styles.themeButtonActive]}
      >
        <MaterialIcons name="light-mode" size={20} color={mode === 'light' ? '#ffffff' : colors.muted} />
      </Pressable>
      <Pressable
        onPress={() => setPreference('dark')}
        accessibilityRole="button"
        accessibilityLabel="Dark theme"
        accessibilityState={{ selected: mode === 'dark' }}
        style={[styles.themeButton, mode === 'dark' && styles.themeButtonActive]}
      >
        <MaterialIcons name="dark-mode" size={20} color={mode === 'dark' ? '#ffffff' : colors.muted} />
      </Pressable>
    </View>
  );
}

/** The app frame: the tabs around the current screen. */
export function AppShell() {
  const { tab, setTab } = useNav();
  const { width } = useWindowDimensions();
  const logOut = useLogOut();

  if (width >= WIDE) {
    return (
      <View style={styles.frame}>
        <View style={styles.panel}>
          <ScrollView
            style={styles.sidebar}
            contentContainerStyle={styles.sidebarContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sidebarGroup}>
              <Logo />
              <View style={styles.sidebarItems}>
                {MAIN_TABS.map((item) => (
                  <SidebarButton key={item.id} icon={item.icon} label={item.label} active={tab === item.id} onPress={() => setTab(item.id)} />
                ))}
              </View>
            </View>
            <View style={styles.sidebarGroup}>
              <View style={styles.sidebarItems}>
                <SidebarButton icon={SETTINGS_TAB.icon} label={SETTINGS_TAB.label} active={tab === 'settings'} onPress={() => setTab('settings')} />
                <SidebarButton icon="logout" label="Log out" onPress={logOut} />
              </View>
              <ThemeSwitch />
            </View>
          </ScrollView>
          <View style={{ flex: 1, minWidth: 0 }}>{content(tab)}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>{content(tab)}</View>
      <BottomTabs />
    </View>
  );
}

function BottomTabs() {
  const { tab, setTab } = useNav();
  const insets = useSafeAreaInsets();
  const items = [...MAIN_TABS, SETTINGS_TAB];
  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bottomItems}>
        {items.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setTab(item.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={styles.bottomItem}
            >
              <View style={[styles.bottomIcon, active && { backgroundColor: colors.navy }]}>
                <MaterialIcons name={item.icon} size={22} color={active ? '#ffffff' : colors.muted} />
              </View>
              <Text style={[styles.bottomLabel, active && { color: colors.text, fontWeight: '700' }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = createStyles(() =>
  StyleSheet.create({
    frame: { flex: 1, backgroundColor: colors.frame, padding: 12 },
    panel: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: colors.bg,
      borderRadius: 28,
      overflow: 'hidden',
    },
    sidebar: { width: 92, flexGrow: 0, backgroundColor: colors.card },
    sidebarContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 22, gap: 24 },
    sidebarGroup: { alignItems: 'center', gap: 26 },
    sidebarItems: { gap: 10, alignItems: 'center' },
    sidebarItem: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    sidebarItemActive: { backgroundColor: colors.navy },
    themeSwitch: { backgroundColor: colors.bg, borderRadius: 22, padding: 4, gap: 4 },
    themeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    themeButtonActive: { backgroundColor: colors.navy },
    logoDot: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: colors.pink },
    bottomBar: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 10,
      ...shadow,
    },
    bottomItems: { paddingHorizontal: 8 },
    bottomItem: { width: 76, alignItems: 'center', gap: 2 },
    bottomIcon: { width: 44, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    bottomLabel: { fontSize: 11, color: colors.muted },
  }),
);
