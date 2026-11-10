// 服务端数据获取函数
import { supabase } from './supabase';
import { Prompt, Tag, PromptType, DbPrompt } from '@/types';
import { mapDbPromptToPrompt } from './type-mapping';
import { buildSearchFilter } from './prompt-query';
import { queryFilterMetadata, queryTags } from './filter-data';
import { runReadQuery } from './read-guard';

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

/**
 * Create empty prompts result for error cases
 */
function createEmptyPromptsResult(page: number, limit: number): PromptsResult {
  return {
    data: [],
    pagination: calculatePagination(page, limit, 0),
  };
}

// 获取提示词列表 (服务端)
export async function fetchPrompts(params: FetchPromptsParams = {}): Promise<PromptsResult> {
  const {
    search = '',
    category = '',
    tag = '',
    page = 1,
    limit = 24,
    prompt_type = 'image',
  } = params;

  const offset = (page - 1) * limit;

  let hiddenDuplicateIds: number[];
  try {
    ({ hiddenDuplicateIds } = await queryFilterMetadata(prompt_type));
  } catch (error) {
    console.error('Error fetching prompt visibility:', error);
    return createEmptyPromptsResult(page, limit);
  }
  let query = supabase.from('prompts').select('*', { count: 'exact' });
  if (hiddenDuplicateIds.length) {
    query = query.not('id', 'in', `(${hiddenDuplicateIds.join(',')})`);
  }

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
    query = query.neq('category', 'NSFW');
  }

  // Apply sorting and pagination
  query = query.order('created_at', { ascending: false })
    .order('id', { ascending: false });

  const { data, error, count } = await runReadQuery((signal) =>
    query.abortSignal(signal).range(offset, offset + limit - 1));

  if (error) {
    console.error('Error fetching prompts:', error);
    return createEmptyPromptsResult(page, limit);
  }

  // Map database records to frontend types using shared mapping function
  const mappedData = (data as DbPrompt[] || []).map(mapDbPromptToPrompt);

  return {
    data: mappedData,
    pagination: calculatePagination(page, limit, count || 0),
  };
}

// SSR and API routes share the same filter aggregation and cache.
export async function fetchTags(prompt_type?: PromptType): Promise<Tag[]> {
  try {
    return await queryTags(prompt_type);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
}

export async function fetchCategories(prompt_type?: PromptType): Promise<string[]> {
  try {
    return (await queryFilterMetadata(prompt_type)).categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

// 获取单个提示词 (服务端)
export async function fetchPromptById(id: number): Promise<Prompt | null> {
  const { data, error } = await runReadQuery((signal) => supabase
    .from('prompts')
    .select('*')
    .eq('id', id)
    .abortSignal(signal).single());

  if (error) {
    console.error('Error fetching prompt:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Map database record to frontend type using shared mapping function
  return mapDbPromptToPrompt(data as DbPrompt);
}
