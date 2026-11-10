// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryFilterMetadata, queryTags } from '@/lib/filter-data';
import { resetCache } from '@/lib/cache';

const { rpc, abortSignal, from } = vi.hoisted(() => ({ rpc: vi.fn(), abortSignal: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from } }));

beforeEach(() => {
  vi.clearAllMocks();
  resetCache();
  rpc.mockReturnValue({ abortSignal });
  abortSignal.mockResolvedValue({ data: { categories: ['创意', '摄影'], tagCounts: { nature: 1001 } }, error: null });
  from.mockReturnValue({ select: () => ({ abortSignal: async () => ({ data: [
    { id: 'nature', slug: 'nature', name_zh: '自然', name_en: 'Nature', count: 999 },
    { id: 'nsfw', slug: 'nsfw', name_zh: 'NSFW', name_en: 'NSFW', count: 999 },
  ], error: null }) }) });
});

describe('Database filter metadata', () => {
  it('shares one aggregate request across concurrent metadata and tag reads', async () => {
    const [metadata, tags] = await Promise.all([queryFilterMetadata('image'), queryTags('image')]);
    expect(metadata.categories).toEqual(['创意', '摄影']);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ slug: 'nature', count: 1001 });
    await queryFilterMetadata('image');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('gallery_filter_metadata', { p_prompt_type: 'image' });
    expect(from).toHaveBeenCalledExactlyOnceWith('tags');
  });

  it('does not cache a failed aggregate and can retry', async () => {
    abortSignal.mockResolvedValueOnce({ data: null, error: { message: 'Network error' } });
    await expect(queryFilterMetadata('functional')).rejects.toThrow('Failed to load filter metadata');
    abortSignal.mockResolvedValueOnce({ data: { categories: ['工作'], tagCounts: {} }, error: null });
    expect((await queryFilterMetadata('functional')).categories).toEqual(['工作']);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
