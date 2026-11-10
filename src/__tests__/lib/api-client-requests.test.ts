import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/lib/api-client';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('API request lifecycle', () => {
  it('does not start a request with an already aborted signal', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();
    const result = await new ApiClient().get('/api/prompts', { signal: controller.signal });
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels immediately while waiting to retry and cleans up timers/listeners', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Network error'));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const result = new ApiClient().get('/api/prompts', { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    controller.abort();
    expect((await result).success).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the timeout active while reading a response body', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => Promise.resolve({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }),
    })));
    const result = new ApiClient({ timeout: 50, retries: 1 }).get('/api/prompts');
    await vi.advanceTimersByTimeAsync(50);
    expect(await result).toEqual({ success: false, error: 'Request timed out' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('supports an initial request when retries are set to zero', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    expect((await new ApiClient({ retries: 0 }).get('/api/prompts')).success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
