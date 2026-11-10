import { NextRequest } from 'next/server';
import { successResponse, ApiError } from '@/lib/api-response';
import { getCache } from '@/lib/cache';
import { queryTags } from '@/lib/filter-data';
import type { PromptType, Tag } from '@/types';
import { readErrorResponse } from '@/lib/read-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rawType = request.nextUrl.searchParams.get('prompt_type');
    if (rawType && rawType !== 'image' && rawType !== 'functional') {
      return ApiError.BAD_REQUEST('prompt_type 必须是 image 或 functional');
    }
    const promptType = (rawType || undefined) as PromptType | undefined;
    const cacheKey = `tags:${promptType || 'all'}`;
    const cache = getCache();
    const cached = cache.get<{ data: Tag[] }>(cacheKey);
    if (cached) return successResponse(cached);

    const result = { data: await queryTags(promptType) };
    cache.set(cacheKey, result);
    return successResponse(result);
  } catch (error) {
    console.error('API /api/tags error:', error);
    return readErrorResponse(error, '加载标签失败');
  }
}
