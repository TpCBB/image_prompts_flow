import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useBrowseState } from '@/hooks/useBrowseState';
import { browseUrl, parseBrowseState, promptShareUrl } from '@/lib/browse-state';

beforeEach(() => window.history.replaceState(null, '', '/'));

describe('Shareable browsing state', () => {
  it('restores language, filters and a detail from a direct URL', () => {
    window.history.replaceState(null, '', '/?type=functional&lang=en&search=meeting&category=Work&tag=writing&prompt=42');
    const { result } = renderHook(() => useBrowseState());
    expect(result.current.state).toEqual({ lang: 'en', promptType: 'functional', search: 'meeting', category: 'Work', tag: 'writing', promptId: 42 });
    expect(document.documentElement.lang).toBe('en');
  });

  it('restores the previous filters when navigating back', async () => {
    const { result } = renderHook(() => useBrowseState());
    act(() => result.current.update({ category: 'Photography' }));
    act(() => result.current.update({ category: 'Design', lang: 'en' }));
    expect(new URLSearchParams(window.location.search).get('category')).toBe('Design');
    act(() => window.history.back());
    await waitFor(() => expect(result.current.state.category).toBe('Photography'));
    expect(result.current.state.lang).toBe('zh');
  });

  it('closes a detail opened from a direct link without leaving the site', () => {
    window.history.replaceState(null, '', '/?prompt=42&tag=nature');
    const { result } = renderHook(() => useBrowseState());
    act(() => result.current.closePrompt());
    expect(window.location.search).toBe('?tag=nature');
    expect(result.current.state.promptId).toBeNull();
  });

  it('validates IDs and keeps unrelated URL parameters', () => {
    const state = parseBrowseState(new URLSearchParams('prompt=1e3&type=invalid&search=' + 'a'.repeat(300)));
    expect(state.promptId).toBeNull();
    expect(state.promptType).toBe('image');
    expect(state.search).toHaveLength(200);
    expect(browseUrl('https://example.com/?utm_source=test', { ...state, search: '', category: '设计' })).toBe('/?utm_source=test&category=%E8%AE%BE%E8%AE%A1');
    expect(promptShareUrl('https://example.com/?tag=nature#top', 42)).toBe('https://example.com/?tag=nature&prompt=42');
  });
});
