'use client';

import { useEffect, useState } from 'react';

const KEY = 'postbook_nav_expanded';

/**
 * Whether the left rail shows labels, remembered per browser.
 *
 * It defaults to EXPANDED: a column of unlabelled icons makes people guess,
 * and the labels are the difference between a tool bar and navigation. The
 * choice persists so someone who prefers the narrow rail keeps it.
 *
 * Starts from the default on the server and adopts the stored value after
 * mount, because localStorage does not exist during server rendering and
 * reading it during the first render would produce a hydration mismatch.
 */
export function useNavExpanded(defaultExpanded = true) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored === '0') setExpanded(false);
      else if (stored === '1') setExpanded(true);
    } catch {
      /* private mode, blocked storage: keep the default */
    }
  }, []);

  const set = (next: boolean) => {
    setExpanded(next);
    try {
      window.localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* not being able to remember it must not stop it toggling */
    }
  };

  return [expanded, set] as const;
}
