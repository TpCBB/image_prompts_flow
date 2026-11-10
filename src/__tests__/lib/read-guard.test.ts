// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { runReadQuery, ReadCapacityError } from '@/lib/read-guard';

describe('Database read capacity', () => {
  it('rejects excess concurrent work without starting it, then releases capacity', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const running = Array.from({ length: 8 }, () => runReadQuery(() => pending));
    const extra = vi.fn(async () => 'unexpected');
    await expect(runReadQuery(extra)).rejects.toThrow(ReadCapacityError);
    expect(extra).not.toHaveBeenCalled();
    release();
    await Promise.all(running);
    expect(await runReadQuery(async () => 'ok')).toBe('ok');
  });

  it('passes an abort signal and releases capacity after failures and timeouts', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    try {
      await expect(runReadQuery(async (signal) => {
        expect(signal).toBe(controller.signal);
        controller.abort();
        return 'too late';
      })).rejects.toThrow(ReadCapacityError);
      await expect(runReadQuery(() => { throw new Error('failed'); })).rejects.toThrow('failed');
    } finally {
      timeout.mockRestore();
    }
    expect(await runReadQuery(async () => 'ok')).toBe('ok');
  });
});
