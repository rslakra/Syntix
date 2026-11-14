import { useCallback, useEffect, useState } from 'react';

import { api, errorMessage } from '../api/client';
import { useDemoReason } from '../api/demo';
import type { Meeting } from '../types';

const REFRESH_MS = 30_000;

/**
 * The meetings the dashboard shows. They come from `api.listMeetings()`, which answers with demo
 * meetings when the API cannot be reached or has none yet (`usingSample`, and `reason` says why).
 * Demo meetings are fully usable: open them, ask about them, search them.
 */
export function useDashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reason = useDemoReason();

  const reload = useCallback(async () => {
    try {
      setMeetings(await api.listMeetings());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  return { meetings, usingSample: reason !== null, reason, error, loading, reload };
}
