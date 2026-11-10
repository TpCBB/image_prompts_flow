import { supabase } from './supabase';
import { getCache } from './cache';
import { isNsfwLabel, isVisibleTag } from './content-visibility';
import { getHiddenDuplicateIds } from './preview-visibility';
import { runReadQuery } from './read-guard';
import type { PromptType, Tag } from '@/types';

interface FilterMetadata {
  categories: string[];
  tagCounts: Map<string, number>;
  hiddenDuplicateIds: number[];
}

const PAGE_SIZE = 1000;

async function readMetadata(promptType?: PromptType): Promise<FilterMetadata> {
  const categories = new Set<string>();
  const tagCounts = new Map<string, number>();
  const rows: { id: number; preview: string | null; prompt_type: string; category: string; tags: string[] | null }[] = [];

  // Supabase limits rows per response. Scan stable pages so older categories
  // and tag counts are not silently lost as the library grows.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase.from('prompts').select('id,preview,prompt_type,category,tags');
    if (promptType) query = query.eq('prompt_type', promptType);
    const { data, error } = await runReadQuery((signal) => query.abortSignal(signal)
      .order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1));
    if (error) throw new Error(error.message);

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  // Select globally before applying search/category/tag filters or pagination.
  const hiddenDuplicateIds = getHiddenDuplicateIds(rows);
  const hidden = new Set(hiddenDuplicateIds);
  for (const row of rows) {
    if (hidden.has(row.id) || isNsfwLabel(row.category)) continue;
    if (row.category?.trim()) categories.add(row.category);
    for (const tag of Array.from(new Set<string>(row.tags || []))) {
      if (!isNsfwLabel(tag)) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const result = { categories: Array.from(categories).sort(), tagCounts, hiddenDuplicateIds };
  return result;
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
