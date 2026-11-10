import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '@/lib/cache';

describe('Concurrent cache loads', () => {
  it('shares failures without poisoning the cache and allows a subsequent retry', async () => {
    const cache = new MemoryCache();
    const load = vi.fn(async () => { throw new Error('offline'); });
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => cache.getOrLoad('key', load)));
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(await cache.getOrLoad('key', async () => 'recovered')).toBe('recovered');
  });

  it('does not repopulate stale data after an admin invalidation during a load', async () => {
    const cache = new MemoryCache();
    let finish!: (value: string) => void;
    const old = cache.getOrLoad('key', () => new Promise<string>((resolve) => { finish = resolve; }));
    await Promise.resolve();
    cache.clear();
    expect(await cache.getOrLoad('key', async () => 'new')).toBe('new');
    finish('old');
    await old;
    expect(cache.get('key')).toBe('new');
  });
});
