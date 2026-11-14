import { confirm } from '../utils/dialog';
import { useNav } from '../utils/nav';
import { signOut } from '../utils/profile';
import { useTheme } from '../utils/theme';

/**
 * "Log out". There are no accounts yet, so it only forgets your name on this device; the screens
 * are rebuilt so the new name shows at once. When sign-in exists, end the session in `signOut`.
 */
export function useLogOut() {
  const { setTab } = useNav();
  const { reload } = useTheme();
  return async () => {
    const ok = await confirm('Log out?', 'There is no sign-in yet, so this only forgets your name on this device.', 'Log out');
    if (!ok) return;
    await signOut();
    setTab('home');
    reload();
  };
}
