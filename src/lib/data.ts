// 服务端数据获取函数
import { supabase } from './supabase';
import { Prompt, Tag, PromptType, DbPrompt } from '@/types';
import { mapDbPromptToPrompt } from './type-mapping';
import { buildSearchFilter } from './prompt-query';
import { queryFilterMetadata, queryTags } from './filter-data';
import { runReadQuery } from './read-guard';
import { getCache } from './cache';

export interface FetchPromptsParams {
  search?: string;
  category?: string;
  tag?: string;
  page?: number;
  limit?: number;
  excludeNsfw?: boolean;
  prompt_type?: PromptType;
}

export interface PromptsResult {
  data: Prompt[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Calculate pagination info from query results
 */
function calculatePagination(
  page: number,
  limit: number,
  total: number
): PromptsResult['pagination'] {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

// 获取提示词列表 (服务端)
async function loadPrompts(params: FetchPromptsParams): Promise<PromptsResult> {
  const {
    search = '',
    category = '',
    tag = '',
    page = 1,
    limit = 24,
    prompt_type = 'image',
  } = params;

  const offset = (page - 1) * limit;

  let query = supabase.from('gallery_prompts').select('*', { count: 'exact' });

  // Apply prompt_type filter
  query = query.eq('prompt_type', prompt_type);

  // Apply search filter
  if (search) {
    query = query.or(buildSearchFilter(search));
  }

  // Apply category filter
  if (category) {
    query = query.eq('category', category);
  }

  // Apply tag filter
  if (tag) {
    query = query.contains('tags', [tag]);
  }

  // 默认过滤 NSFW 内容
  if (params.excludeNsfw !== false) {
    query = query.eq('is_nsfw', false);
  }

  // Apply sorting and pagination
  query = query.order('created_at', { ascending: false })
    .order('id', { ascending: false });

  const { data, error, count } = await runReadQuery((signal) =>
    query.abortSignal(signal).range(offset, offset + limit - 1));

  if (error) {
    throw new Error('Failed to load prompts', { cause: error });
  }

  // Map database records to frontend types using shared mapping function
  const mappedData = (data as DbPrompt[] || []).map(mapDbPromptToPrompt);

  return {
    data: mappedData,
    pagination: calculatePagination(page, limit, count || 0),
  };
}

// SSR and API reads share one query and one cache, including concurrent misses.
export function fetchPrompts(params: FetchPromptsParams = {}): Promise<PromptsResult> {
  const normalized = { search: params.search?.trim() || '', category: params.category || '', tag: params.tag || '',
    page: params.page ?? 1, limit: params.limit ?? 24, excludeNsfw: params.excludeNsfw !== false, prompt_type: params.prompt_type || 'image' };
  return getCache().getOrLoad(`prompts:${JSON.stringify(normalized)}`, () => loadPrompts(normalized));
}

// SSR and API routes share the same filter aggregation and cache.
export async function fetchTags(prompt_type?: PromptType): Promise<Tag[]> {
  return queryTags(prompt_type);
}

export async function fetchCategories(prompt_type?: PromptType): Promise<string[]> {
  return (await queryFilterMetadata(prompt_type)).categories;
}

// 获取单个提示词 (服务端)
export async function fetchPromptById(id: number): Promise<Prompt | null> {
  const { data, error } = await runReadQuery((signal) => supabase
    .from('prompts')
    .select('*')
    .eq('id', id)
    .abortSignal(signal).single());

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error('Failed to load prompt', { cause: error });
  }

  if (!data) {
    return null;
  }

  // Map database record to frontend type using shared mapping function
  return mapDbPromptToPrompt(data as DbPrompt);
}
