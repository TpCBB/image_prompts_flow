import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { successResponse, ApiError } from "@/lib/api-response";
import { getCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

// Cache TTL: 60 seconds
const CACHE_TTL = 60 * 1000;

/**
 * Generate cache key for tags query
 */
function generateCacheKey(promptType: string): string {
  return `tags:${promptType || 'all'}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const promptType = searchParams.get("prompt_type") || "";

    // Check cache first
    const cache = getCache();
    const cacheKey = generateCacheKey(promptType);
    const cachedResult = cache.get<{ data: unknown[] }>(cacheKey);

    if (cachedResult) {
      return successResponse(cachedResult);
    }

    // 如果指定了 prompt_type，使用单一聚合查询获取标签数量 (Requirements 6.2)
    if (promptType) {
      // 使用单一查询获取该类型下所有 prompts 的 tags，并在内存中聚合
      // 这比之前的多次查询更高效
      const { data: prompts, error } = await supabase
        .from("prompts")
        .select("tags")
        .eq("prompt_type", promptType)
        .not("tags", "is", null);

      if (error) {
        return ApiError.SERVER_ERROR(error.message);
      }

      // 统计每个标签的数量 - 单次遍历聚合
      const tagCounts = new Map<string, number>();
      prompts?.forEach((p) => {
        p.tags?.forEach((tag: string) => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });

      // 获取标签详情 - 单次查询
      const { data: tagsData, error: tagsError } = await supabase
        .from("tags")
        .select("*");

      if (tagsError) {
        return ApiError.SERVER_ERROR(tagsError.message);
      }

      // 合并数量，过滤掉数量为 0 的标签，并排序
      const filteredTags = (tagsData || [])
        .map((tag) => ({
          ...tag,
          count: tagCounts.get(tag.slug) || 0,
        }))
        .filter((tag) => tag.count > 0)
        .sort((a, b) => b.count - a.count);

      const result = { data: filteredTags };
      
      // Store in cache
      cache.set(cacheKey, result, CACHE_TTL);

      return successResponse(result);
    }

    // 默认返回所有标签
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .order("count", { ascending: false });

    if (error) {
      return ApiError.SERVER_ERROR(error.message);
    }

    const result = { data: data || [] };
    
    // Store in cache
    cache.set(cacheKey, result, CACHE_TTL);

    return successResponse(result);
  } catch (err) {
    console.error("API /api/tags error:", err);
    return ApiError.SERVER_ERROR("Internal server error");
  }
}
