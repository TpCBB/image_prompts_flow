import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { successResponse, ApiError } from "@/lib/api-response";
import { getCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

// Cache TTL: 60 seconds
const CACHE_TTL = 60 * 1000;

/**
 * Generate cache key for categories query
 */
function generateCacheKey(promptType: string): string {
  return `categories:${promptType || 'all'}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const promptType = searchParams.get("prompt_type") || "";

    // Check cache first
    const cache = getCache();
    const cacheKey = generateCacheKey(promptType);
    const cachedResult = cache.get<{ data: string[] }>(cacheKey);

    if (cachedResult) {
      return successResponse(cachedResult);
    }

    // 使用 SELECT DISTINCT 优化查询 (Requirements 6.1)
    // Supabase 不直接支持 DISTINCT，但我们可以通过 RPC 或在应用层处理
    // 这里使用更高效的方式：只选择 category 字段，然后在应用层去重
    let query = supabase.from("prompts").select("category");

    // 如果指定了 prompt_type，只获取该类型的分类
    if (promptType) {
      query = query.eq("prompt_type", promptType);
    }

    const { data, error } = await query;

    if (error) {
      return ApiError.SERVER_ERROR(error.message);
    }

    // 使用 Set 进行高效去重
    const categoriesSet = new Set<string>();
    data?.forEach((item) => {
      if (item.category) {
        categoriesSet.add(item.category);
      }
    });
    
    // 转换为数组并排序
    const categories = Array.from(categoriesSet).sort();

    const result = { data: categories };
    
    // Store in cache
    cache.set(cacheKey, result, CACHE_TTL);

    return successResponse(result);
  } catch (err) {
    console.error("API /api/categories error:", err);
    return ApiError.SERVER_ERROR("Internal server error");
  }
}
