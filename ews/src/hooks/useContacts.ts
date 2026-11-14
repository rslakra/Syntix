import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { SAMPLE_CONTACTS, type Contact } from '../data/sample';
import { pastels } from '../theme';

const STORAGE_KEY = 'syntix.contacts';

/**
 * The contact list. There is no contacts API yet, so it is kept on this device (AsyncStorage),
 * starting from sample contacts. When the API exists, replace the body of this hook (load, add,
 * remove) and nothing else has to change.
 */
export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>(SAMPLE_CONTACTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved) setContacts(JSON.parse(saved) as Contact[]);
      })
      .catch(() => undefined);
  }, []);

  const save = useCallback((next: Contact[]) => {
    setContacts(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const add = useCallback(
    (contact: { name: string; role: string; email: string }) => {
      const created: Contact = {
        id: `contact-${Date.now()}`,
        name: contact.name.trim(),
        role: contact.role.trim() || 'Contact',
        email: contact.email.trim(),
        tint: pastels[contacts.length % pastels.length],
      };
      save([...contacts, created]);
      return created;
    },
    [contacts, save],
  );

  const remove = useCallback((id: string) => save(contacts.filter((c) => c.id !== id)), [contacts, save]);

  /** True while any sample contact is still in the list, so the UI can label it as sample data. */
  const hasSample = contacts.some((c) => c.id.startsWith('sample-'));

  return { contacts, add, remove, hasSample };
}
