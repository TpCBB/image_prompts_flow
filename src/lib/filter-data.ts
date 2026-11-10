import { supabase } from './supabase';
import { getCache } from './cache';
import { isVisibleTag } from './content-visibility';
import { runReadQuery } from './read-guard';
import type { PromptType, Tag } from '@/types';

interface FilterMetadata {
  categories: string[];
  tagCounts: Map<string, number>;
}

async function readMetadata(promptType?: PromptType): Promise<FilterMetadata> {
  const { data, error } = await runReadQuery((signal) => supabase
    .rpc('gallery_filter_metadata', { p_prompt_type: promptType || null }).abortSignal(signal));
  if (error) throw new Error('Failed to load filter metadata', { cause: error });
  const result = data as { categories: string[]; tagCounts: Record<string, number> } | null;
  if (!result || !Array.isArray(result.categories) || !result.tagCounts || typeof result.tagCounts !== 'object') {
    throw new Error('Invalid filter metadata response');
  }
  return { categories: result.categories, tagCounts: new Map(Object.entries(result.tagCounts)) };
}

export async function queryFilterMetadata(promptType?: PromptType): Promise<FilterMetadata> {
  const key = `filter-metadata:${promptType || 'all'}`;
  return getCache().getOrLoad(key, () => readMetadata(promptType), 5 * 60_000);
}

export async function queryTags(promptType?: PromptType): Promise<Tag[]> {
  return getCache().getOrLoad(`tags-data:${promptType || 'all'}`, async () => {
    const [{ tagCounts }, { data, error }] = await Promise.all([
      queryFilterMetadata(promptType),
      runReadQuery((signal) => supabase.from('tags').select('*').abortSignal(signal)),
    ]);
    if (error) throw new Error(error.message);
    return (data || [])
      .map((tag) => ({ ...tag, count: tagCounts.get(tag.slug) || 0 }))
      .filter((tag) => tag.count > 0 && isVisibleTag(tag))
      .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
  }, 5 * 60_000);
}
