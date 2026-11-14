import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler } from 'react-native';

export type Tab = 'search' | 'home' | 'reports' | 'trends' | 'contacts' | 'ask' | 'meetings' | 'settings';

export type Route =
  | { name: 'home' }
  | { name: 'schedule' }
  | { name: 'meeting'; id: string }
  | { name: 'call'; id: string };

interface Nav {
  route: Route;
  tab: Tab;
  setTab: (tab: Tab) => void;
  push: (route: Route) => void;
  replace: (route: Route) => void;
  pop: () => void;
  canGoBack: boolean;
}

const NavContext = createContext<Nav | null>(null);

/** A minimal stack navigator: the last route is on screen; Android's back button pops it. */
export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [tab, setTab] = useState<Tab>('home');

  const push = useCallback((route: Route) => setStack((s) => [...s, route]), []);
  const replace = useCallback((route: Route) => setStack((s) => [...s.slice(0, -1), route]), []);
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);

  const canGoBack = stack.length > 1;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      pop();
      return true;
    });
    return () => subscription.remove();
  }, [canGoBack, pop]);

  const value = useMemo<Nav>(
    () => ({ route: stack[stack.length - 1], tab, setTab, push, replace, pop, canGoBack }),
    [stack, tab, push, replace, pop, canGoBack],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav must be used inside <NavProvider>');
  return nav;
}
