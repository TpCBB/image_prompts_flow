import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPrompts, fetchCategories, fetchTags } from '@/lib/data';
import { resetCache } from '@/lib/cache';
import { queryFilterMetadata, queryTags } from '@/lib/filter-data';

const { query } = vi.hoisted(() => ({ query: {
  select: vi.fn(), eq: vi.fn(), neq: vi.fn(), not: vi.fn(), order: vi.fn(), abortSignal: vi.fn(), range: vi.fn(),
} }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => query } }));
vi.mock('@/lib/filter-data', () => ({ queryFilterMetadata: vi.fn(), queryTags: vi.fn() }));

beforeEach(() => {
  resetCache();
  for (const method of Object.values(query)) method.mockReturnValue(query);
  vi.mocked(queryFilterMetadata).mockResolvedValue({ categories: [], tagCounts: new Map() });
});

describe('Initial load errors', () => {
  it('rejects database errors instead of reporting an empty successful library', async () => {
    query.range.mockResolvedValue({ data: null, count: null, error: { message: 'Database unavailable' } });
    await expect(fetchPrompts()).rejects.toThrow('Failed to load prompts');
    query.range.mockResolvedValue({ data: [], count: 0, error: null });
    await expect(fetchPrompts()).resolves.toMatchObject({ data: [], pagination: { total: 0 } });
  });

  it('does not swallow metadata or tag failures', async () => {
    vi.mocked(queryFilterMetadata).mockRejectedValue(new Error('Metadata unavailable'));
    await expect(fetchCategories()).rejects.toThrow('Metadata unavailable');
    vi.mocked(queryTags).mockRejectedValue(new Error('Tags unavailable'));
    await expect(fetchTags()).rejects.toThrow('Tags unavailable');
  });
});
