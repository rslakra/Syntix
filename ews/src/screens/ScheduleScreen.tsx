import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { api, errorMessage } from '../api/client';
import { Button, Chip, ErrorBanner, Field, Muted, Screen } from '../components/ui';
import { parseLocalDateTime, parseParticipants, toDateInput, toTimeInput } from '../utils/format';
import { useNav } from '../utils/nav';
import { space } from '../theme';

function inOneHour(): Date {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date;
}

function tomorrowAt(hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export function ScheduleScreen() {
  const nav = useNav();
  const initial = inOneHour();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toDateInput(initial));
  const [time, setTime] = useState(toTimeInput(initial));
  const [participants, setParticipants] = useState('');
  const [language, setLanguage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (value: Date) => {
    setDate(toDateInput(value));
    setTime(toTimeInput(value));
  };

  const save = async (thenStart: boolean) => {
    setError(null);
    if (!title.trim()) return setError('Give the meeting a title.');
    const when = parseLocalDateTime(date, time);
    if (!when) return setError('Use the date format YYYY-MM-DD and the time format HH:MM (24 hours).');
    setSaving(true);
    try {
      const meeting = await api.createMeeting({
        title: title.trim(),
        description: description.trim() || null,
        language: language.trim() || null,
        scheduled_at: when.toISOString(),
        participants: parseParticipants(participants),
      });
      nav.replace(thenStart ? { name: 'call', id: meeting.id } : { name: 'meeting', id: meeting.id });
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Screen title="Schedule a meeting" onBack={nav.pop}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Q3 planning" autoFocus />
          <Field
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Agenda, goals…"
            multiline
          />

          <View style={styles.row}>
            <View style={{ flex: 3 }}>
              <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
            </View>
            <View style={{ flex: 2 }}>
              <Field label="Time" value={time} onChangeText={setTime} placeholder="HH:MM" autoCapitalize="none" />
            </View>
          </View>
          <View style={styles.chips}>
            <Chip label="In 1 hour" onPress={() => apply(inOneHour())} />
            <Chip label="Tomorrow 9:00" onPress={() => apply(tomorrowAt(9))} />
            <Chip label="Tomorrow 14:00" onPress={() => apply(tomorrowAt(14))} />
          </View>

          <Field
            label="Participants (one per line or comma-separated)"
            value={participants}
            onChangeText={setParticipants}
            placeholder={'Ana <ana@example.com>\nBob'}
            multiline
            autoCapitalize="words"
          />
          <Field
            label="Spoken language (optional, e.g. en)"
            value={language}
            onChangeText={setLanguage}
            placeholder="auto-detect"
            autoCapitalize="none"
            maxLength={16}
          />
          <Muted>Times are in your local time zone.</Muted>

          <View style={{ gap: space.md, marginTop: space.lg }}>
            <Button title="Save meeting" onPress={() => save(false)} loading={saving} />
            <Button title="Save and start now" variant="secondary" onPress={() => save(true)} disabled={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
});
