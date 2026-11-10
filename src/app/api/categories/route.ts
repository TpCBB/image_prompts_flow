import { NextRequest } from 'next/server';
import { successResponse, ApiError } from '@/lib/api-response';
import { getCache } from '@/lib/cache';
import { queryFilterMetadata } from '@/lib/filter-data';
import type { PromptType } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rawType = request.nextUrl.searchParams.get('prompt_type');
    if (rawType && rawType !== 'image' && rawType !== 'functional') {
      return ApiError.BAD_REQUEST('prompt_type 必须是 image 或 functional');
    }
    const promptType = (rawType || undefined) as PromptType | undefined;
    const cacheKey = `categories:${promptType || 'all'}`;
    const cache = getCache();
    const cached = cache.get<{ data: string[] }>(cacheKey);
    if (cached) return successResponse(cached);

    const result = { data: (await queryFilterMetadata(promptType)).categories };
    cache.set(cacheKey, result);
    return successResponse(result);
  } catch (error) {
    console.error('API /api/categories error:', error);
    return ApiError.SERVER_ERROR('加载分类失败');
  }
}
