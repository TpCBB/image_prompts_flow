// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryFilterMetadata, queryTags } from '@/lib/filter-data';
import { resetCache } from '@/lib/cache';

const { query, from, tagResult } = vi.hoisted(() => ({
  query: { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() },
  from: vi.fn(),
  tagResult: { data: [
    { id: 'nature', slug: 'nature', name_zh: '自然', name_en: 'Nature', count: 999 },
    { id: 'nsfw', slug: 'nsfw', name_zh: 'NSFW', name_en: 'NSFW', count: 999 },
  ], error: null },
}));
vi.mock('@/lib/supabase', () => ({ supabase: { from } }));

beforeEach(() => {
  vi.clearAllMocks();
  resetCache();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  from.mockImplementation((table) => table === 'tags' ? { select: async () => tagResult } : query);
});

describe('Filter metadata', () => {
  it('deduplicates across scan pages before counting tags and categories', async () => {
    query.range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1, preview: i === 0 ? 'shared.jpg' : `${i}.jpg`, prompt_type: 'image',
      category: '创意', tags: ['nature'],
    })), error: null }).mockResolvedValueOnce({ data: [
      { id: 1001, preview: 'shared.jpg', prompt_type: 'image', category: '创意', tags: ['nature'] },
      { id: 1002, preview: 'last.jpg', prompt_type: 'image', category: '摄影', tags: [] },
    ], error: null });
    const metadata = await queryFilterMetadata('image');
    expect(metadata.hiddenDuplicateIds).toHaveLength(1);
    expect([1, 1001]).toContain(metadata.hiddenDuplicateIds[0]);
    expect(metadata.categories).toEqual(['创意', '摄影']);
    expect(metadata.tagCounts.get('nature')).toBe(1000);
  });

  it('reads past the first 1000 rows, shares concurrent scans, and counts only visible prompts', async () => {
    query.range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({ category: '创意', tags: ['nature', 'nature'] })), error: null })
      .mockResolvedValueOnce({ data: [
        { category: '摄影', tags: ['nature'] },
        { category: 'NSFW', tags: ['nature', 'nsfw'] },
      ], error: null });
    const [metadata, tags] = await Promise.all([queryFilterMetadata('image'), queryTags('image')]);
    expect(metadata.categories).toEqual(['创意', '摄影']);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ slug: 'nature', count: 1001 });
    expect(query.range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
    await queryFilterMetadata('image');
    expect(query.range).toHaveBeenCalledTimes(2);
  });

  it('does not cache a partially failed scan and can retry', async () => {
    query.range.mockResolvedValueOnce({ data: null, error: { message: 'Network error' } });
    await expect(queryFilterMetadata('functional')).rejects.toThrow('Network error');
    query.range.mockResolvedValueOnce({ data: [{ category: '工作', tags: [] }], error: null });
    expect((await queryFilterMetadata('functional')).categories).toEqual(['工作']);
  });
});
