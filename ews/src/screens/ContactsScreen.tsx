import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../components/Text';

import { SampleChip } from '../components/panel';
import { Button, Card, ErrorBanner, Field, Muted, Screen } from '../components/ui';
import type { Contact } from '../data/sample';
import { useContacts } from '../hooks/useContacts';
import { useDashboard } from '../hooks/useDashboard';
import { colors, createStyles, fonts, radius, shadow, space } from '../theme';
import { confirm } from '../utils/dialog';
import { useNav } from '../utils/nav';

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** A steady made-up meeting count per person, until the API reports the real one. */
const meetingsWith = (name: string) => 2 + (name.length * 7) % 11;

/**
 * Contacts. There is no contacts API yet, so the list is sample data you can search, add to and
 * remove from, kept on this device (see useContacts).
 */
export function ContactsScreen() {
  const nav = useNav();
  const { contacts, add, remove, hasSample } = useContacts();
  const { meetings } = useDashboard();
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', email: '' });
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return term
      ? contacts.filter((c) => `${c.name} ${c.role} ${c.email}`.toLowerCase().includes(term))
      : contacts;
  }, [contacts, filter]);
  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  const save = () => {
    if (!form.name.trim()) return setError('Give the contact a name.');
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('That email address does not look right.');
    const created = add(form);
    setForm({ name: '', role: '', email: '' });
    setAdding(false);
    setError(null);
    setSelectedId(created.id);
  };

  const confirmRemove = async (contact: Contact) => {
    if (!(await confirm(`Remove ${contact.name}?`, 'They disappear from your contacts on this device.', 'Remove'))) return;
    remove(contact.id);
    setSelectedId(null);
  };

  return (
    <Screen
      title="Contacts"
      bottomInset={false}
      right={
        <>
          {hasSample ? <SampleChip /> : null}
          <Button title={adding ? 'Cancel' : '+ Add contact'} variant={adding ? 'secondary' : 'primary'} onPress={() => setAdding((v) => !v)} style={{ minHeight: 40 }} />
        </>
      }
    >
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
        {adding ? (
          <Card>
            <Text style={styles.heading}>New contact</Text>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <Field label="Name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} autoCapitalize="words" placeholder="Ana Rivera" />
            <Field label="Role (optional)" value={form.role} onChangeText={(role) => setForm({ ...form, role })} autoCapitalize="words" placeholder="Product manager" />
            <Field label="Email (optional)" value={form.email} onChangeText={(email) => setForm({ ...form, email })} autoCapitalize="none" keyboardType="email-address" placeholder="ana@example.com" />
            <Button title="Save contact" onPress={save} />
          </Card>
        ) : null}

        <View style={styles.search}>
          <MaterialIcons name="search" size={20} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={filter}
            onChangeText={setFilter}
            placeholder="Search contacts"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
        </View>

        {selected ? (
          <Card>
            <View style={styles.detailHead}>
              <View style={[styles.tile, { backgroundColor: selected.tint }]}>
                <Text style={styles.initials}>{initialsOf(selected.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{selected.name}</Text>
                <Text style={styles.role}>{selected.role}</Text>
                {selected.email ? <Text style={styles.role}>{selected.email}</Text> : null}
              </View>
            </View>
            <Text style={[styles.heading, { marginTop: space.lg }]}>Recent meetings</Text>
            {meetings.slice(0, 3).map((meeting) => (
              <Text key={meeting.id} style={styles.recent} numberOfLines={1}>
                • {meeting.title}
              </Text>
            ))}
            <Muted>Sample association: the API will list the meetings this person was in.</Muted>
            <View style={styles.actions}>
              <Button title="Invite to a meeting" onPress={() => nav.push({ name: 'schedule' })} style={{ flex: 1 }} />
              <Button title="Remove" variant="secondary" onPress={() => confirmRemove(selected)} />
            </View>
          </Card>
        ) : null}

        {shown.length === 0 ? (
          <Card>
            <Muted>No contacts match "{filter}".</Muted>
          </Card>
        ) : null}
        <View style={styles.grid}>
          {shown.map((contact) => {
            const active = contact.id === selectedId;
            return (
              <Pressable key={contact.id} onPress={() => setSelectedId(active ? null : contact.id)} style={[styles.card, active && styles.cardActive]}>
                <View style={[styles.tile, { backgroundColor: contact.tint }]}>
                  <Text style={styles.initials}>{initialsOf(contact.name)}</Text>
                </View>
                <Text style={[styles.name, active && { color: colors.pink }]} numberOfLines={1}>
                  {contact.name}
                </Text>
                <Text style={styles.role} numberOfLines={1}>
                  {contact.role}
                </Text>
                <Text style={styles.count}>{meetingsWith(contact.name)} meetings</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = createStyles(() =>
  StyleSheet.create({
    heading: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: space.sm },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      backgroundColor: colors.card,
      borderRadius: 999,
      paddingHorizontal: space.lg,
      ...shadow,
    },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.text, fontFamily: fonts.regular },
    detailHead: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
    actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
    recent: { fontSize: 14, color: colors.text, marginBottom: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    card: {
      flexGrow: 1,
      flexBasis: 150,
      maxWidth: 240,
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.card,
      borderRadius: radius + 4,
      padding: 18,
      borderWidth: 2,
      borderColor: 'transparent',
      ...shadow,
    },
    cardActive: { borderColor: colors.pink },
    tile: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    initials: { fontSize: 24, fontWeight: '600', color: '#2b2a5a' },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    role: { fontSize: 13, color: colors.muted },
    count: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 4 },
  }),
);
