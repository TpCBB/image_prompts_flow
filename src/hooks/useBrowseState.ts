'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { browseUrl, DEFAULT_BROWSE_STATE, parseBrowseState, type BrowseState } from '@/lib/browse-state';

export function useBrowseState(initial: BrowseState = DEFAULT_BROWSE_STATE) {
  const [state, setState] = useState(initial);
  const current = useRef(state);
  current.current = state;

  useEffect(() => {
    const restore = () => { const next = parseBrowseState(new URLSearchParams(window.location.search)); current.current = next; setState(next); };
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  useEffect(() => { document.documentElement.lang = state.lang; }, [state.lang]);

  const update = useCallback((patch: Partial<BrowseState>, mode: 'push' | 'replace' = 'push') => {
    const next = { ...current.current, ...patch };
    if (JSON.stringify(next) === JSON.stringify(current.current)) return;
    current.current = next;
    const historyState = { ...window.history.state };
    if ('promptId' in patch) historyState.promptLibraryModal = !!patch.promptId && mode === 'push';
    const href = browseUrl(window.location.href, next);
    if (mode === 'replace') window.history.replaceState(historyState, '', href);
    else window.history.pushState(historyState, '', href);
    setState(next);
  }, []);

  const closePrompt = useCallback(() => {
    if (window.history.state?.promptLibraryModal) window.history.back();
    else update({ promptId: null }, 'replace');
  }, [update]);

  return { state, update, closePrompt };
}
