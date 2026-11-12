import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PromptsContainer from '@/components/PromptsContainer';
import { ToastProvider } from '@/contexts/ToastContext';
import type { Prompt } from '@/types';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ getApiClient: () => ({ get }) }));
vi.mock('@/components/PromptCard', () => ({
  default: ({ prompt }: { prompt: Prompt }) => <h3>{prompt.title}</h3>,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const prompt = (id: number, title: string): Prompt => ({
  id, title, prompt: 'Example', author: 'Author', category: '创意',
  mode: 'generate', created_at: '2026-11-10', prompt_type: 'image',
});
const pagination = { page: 1, limit: 24, total: 48, totalPages: 2, hasMore: true };
const response = (title: string) => ({
  success: true, data: [prompt(2, title)], pagination: { ...pagination, hasMore: false },
});
function mount() {
  return render(<StrictMode><ToastProvider><PromptsContainer
    initialPrompts={{ data: [prompt(1, 'Initial prompt')], pagination }}
    initialCategories={['创意', '摄影', 'NSFW', ' nsfw ']}
    initialTags={[
      { id: 'hidden', slug: 'nsfw', name_zh: 'NSFW', name_en: 'NSFW', count: 99 },
      { id: 'visible', slug: 'nature', name_zh: '自然', name_en: 'Nature', count: 2 },
    ]}
  /></ToastProvider></StrictMode>);
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  get.mockReset();
  get.mockResolvedValue({ success: true, data: [] });
});

describe('Prompt browsing', () => {
  it('uses SSR data in Strict Mode, hides NSFW filters and does not refetch on language changes', () => {
    mount();
    expect(screen.getByText('Initial prompt')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nsfw/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('EN'));
    expect(screen.getByText('Initial prompt')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('ignores an old response after filters are cleared', async () => {
    const old = deferred<ReturnType<typeof response>>();
    get.mockReturnValueOnce(old.promise);
    mount();
    fireEvent.click(screen.getByRole('button', { name: '创意' }));
    const signal = get.mock.calls[0][1].signal as AbortSignal;
    fireEvent.click(screen.getByRole('button', { name: '全部分类' }));
    expect(signal.aborted).toBe(true);
    expect(screen.getByText('Initial prompt')).toBeInTheDocument();
    await act(async () => { old.resolve(response('Stale prompt')); });
    expect(screen.queryByText('Stale prompt')).not.toBeInTheDocument();
    expect(screen.getByText('Initial prompt')).toBeInTheDocument();
  });

  it('keeps the newest result even when the earlier request completes last', async () => {
    const old = deferred<ReturnType<typeof response>>();
    const latest = deferred<ReturnType<typeof response>>();
    get.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    mount();
    fireEvent.click(screen.getByRole('button', { name: '创意' }));
    fireEvent.click(screen.getByRole('button', { name: '摄影' }));
    await act(async () => { latest.resolve(response('Newest prompt')); });
    await act(async () => { old.resolve(response('Stale prompt')); });
    expect(screen.getByText('Newest prompt')).toBeInTheDocument();
    expect(screen.queryByText('Stale prompt')).not.toBeInTheDocument();
  });

  it('resets category and tag together before requesting a different prompt type', async () => {
    get.mockImplementation(async (path) => path === '/api/prompts' ? response('Filtered prompt') : { success: true, data: [] });
    mount();
    fireEvent.click(screen.getByRole('button', { name: '创意' }));
    await screen.findByText('Filtered prompt');
    fireEvent.click(screen.getByRole('button', { name: '自然(2)' }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    get.mockClear();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '功能性 Prompt' })); });
    const calls = get.mock.calls.filter(([path]) => path === '/api/prompts');
    expect(calls).toHaveLength(1);
    expect(calls[0][1].params).toMatchObject({ prompt_type: 'functional', category: undefined, tag: undefined });
  });

  it('appends pages once, removes duplicate IDs and preserves the result on language changes', async () => {
    const nextPage = deferred<ReturnType<typeof response>>();
    get.mockReturnValueOnce(nextPage.promise);
    mount();
    const initialCard = screen.getByText('Initial prompt');
    const initialPage = initialCard.parentElement;
    const button = screen.getByRole('button', { name: '加载更多' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(get).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Initial prompt')).toBe(initialCard);
    await act(async () => {
      nextPage.resolve({ ...response('Next page'), data: [prompt(1, 'Duplicate'), prompt(2, 'Next page'), prompt(2, 'Repeated in page')] });
    });
    expect(screen.getByText('Initial prompt')).toBe(initialCard);
    expect(initialCard.parentElement).toBe(initialPage);
    expect(initialPage?.children).toHaveLength(1);
    const appendedPage = screen.getByText('Next page').parentElement;
    expect(initialPage?.nextElementSibling).toBe(appendedPage);
    expect(appendedPage?.children).toHaveLength(1);
    expect(screen.queryByText('Duplicate')).not.toBeInTheDocument();
    expect(screen.queryByText('Repeated in page')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('EN'));
    expect(screen.getByText('Next page')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('keeps earlier batches intact across multiple loads and resets them when filtering', async () => {
    get.mockResolvedValueOnce({ ...response('Second page'), pagination: { ...pagination, page: 2, hasMore: true } });
    mount();
    const initialPage = screen.getByText('Initial prompt').parentElement;
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    const secondCard = await screen.findByText('Second page');
    const secondPage = secondCard.parentElement;
    get.mockResolvedValueOnce({ ...response('Last page'), data: [prompt(3, 'Last page')] });
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    const lastCard = await screen.findByText('Last page');
    expect(screen.getByText('Initial prompt').parentElement).toBe(initialPage);
    expect(screen.getByText('Second page')).toBe(secondCard);
    expect(initialPage?.nextElementSibling).toBe(secondPage);
    expect(secondPage?.nextElementSibling).toBe(lastCard.parentElement);
    expect(get.mock.calls.map(([, options]) => options.params.page)).toEqual([2, 3]);
    expect(screen.queryByRole('button', { name: '加载更多' })).not.toBeInTheDocument();

    get.mockResolvedValueOnce(response('Filtered page'));
    fireEvent.click(screen.getByRole('button', { name: '创意' }));
    const filteredCard = await screen.findByText('Filtered page');
    expect(filteredCard.parentElement?.parentElement?.children).toHaveLength(1);
    expect(screen.queryByText('Initial prompt')).not.toBeInTheDocument();
    expect(screen.queryByText('Second page')).not.toBeInTheDocument();
    expect(screen.queryByText('Last page')).not.toBeInTheDocument();
  });

  it('shows a retry control instead of an empty result when a request fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    get.mockResolvedValueOnce({ success: false, error: 'Offline' });
    mount();
    fireEvent.click(screen.getByRole('button', { name: '创意' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('没有找到匹配的提示词')).not.toBeInTheDocument();
    get.mockResolvedValueOnce(response('Recovered prompt'));
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('Recovered prompt')).toBeInTheDocument();
    error.mockRestore();
  });
});
