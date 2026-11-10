import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-server";
import { successResponse, ApiError } from "@/lib/api-response";
import { getCache } from "@/lib/cache";
import { mapDbPromptToPrompt } from "@/lib/type-mapping";
import { DbPrompt } from "@/types";

export const dynamic = "force-dynamic";

// Cache TTL: 60 seconds
const CACHE_TTL = 60 * 1000;

/**
 * Generate cache key from query parameters
 */
function generateCacheKey(params: Record<string, string>): string {
  const sortedParams = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return `prompts:${sortedParams}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 获取查询参数
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const tag = searchParams.get("tag") || "";
    const promptType = searchParams.get("prompt_type") || "";
    const excludeNsfw = searchParams.get("excludeNsfw") === "true";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "24", 10);
    const offset = (page - 1) * limit;

    // Generate cache key
    const cacheKey = generateCacheKey({
      search,
      category,
      tag,
      promptType,
      excludeNsfw: String(excludeNsfw),
      page: String(page),
      limit: String(limit),
    });

    // Check cache first
    const cache = getCache();
    const cachedResult = cache.get<{
      data: ReturnType<typeof mapDbPromptToPrompt>[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
      };
    }>(cacheKey);

    if (cachedResult) {
      return successResponse(cachedResult);
    }

    // 构建查询
    let query = supabase.from("prompts").select("*", { count: "exact" });

    // 搜索过滤
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,prompt.ilike.%${search}%,author.ilike.%${search}%`
      );
    }

    // 分类过滤
    if (category) {
      query = query.eq("category", category);
    }

    // 标签过滤
    if (tag) {
      query = query.contains("tags", [tag]);
    }

    // prompt_type 过滤
    if (promptType) {
      query = query.eq("prompt_type", promptType);
    }

    // NSFW 过滤（默认排除，除非明确选择 NSFW 分类）
    if (excludeNsfw) {
      query = query.neq("category", "NSFW");
    }

    // ORDER BY created_at DESC for consistent sorting (Requirements 2.3)
    query = query.order("created_at", { ascending: false });

    // 分页
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return ApiError.SERVER_ERROR(error.message);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    // Map database records to frontend Prompt type (Requirements 3.1, 3.2)
    const prompts = (data as DbPrompt[] || []).map(mapDbPromptToPrompt);

    const result = {
      data: prompts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };

    // Store in cache
    cache.set(cacheKey, result, CACHE_TTL);

    return successResponse(result);
  } catch (err) {
    console.error("API /api/prompts error:", err);
    return ApiError.SERVER_ERROR("Internal server error");
  }
}

// 创建新提示词
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证必填字段
    const { title, preview, prompt, author, mode, category } = body;
    if (!title || !preview || !prompt || !author || !mode || !category) {
      return ApiError.BAD_REQUEST(
        "缺少必填字段: title, preview, prompt, author, mode, category"
      );
    }

    // 验证 mode 值
    if (!["generate", "edit"].includes(mode)) {
      return ApiError.BAD_REQUEST("mode 必须是 generate 或 edit");
    }

    const { data, error } = await supabaseAdmin
      .from("prompts")
      .insert({
        title: body.title,
        title_en: body.title_en || null,
        preview: body.preview,
        prompt: body.prompt,
        prompt_en: body.prompt_en || null,
        description: body.description || null,
        description_en: body.description_en || null,
        author: body.author,
        link: body.link || null,
        mode: body.mode,
        category: body.category,
        sub_category: body.sub_category || null,
        tags: body.tags || null,
        prompt_type: body.prompt_type || "image",
        use_cases: body.use_cases || null,
      })
      .select()
      .single();

    if (error) {
      return ApiError.SERVER_ERROR(error.message);
    }

    // Invalidate cache after creating new prompt
    const cache = getCache();
    cache.clear();

    return successResponse(data, "创建成功");
  } catch {
    return ApiError.BAD_REQUEST("请求体解析失败");
  }
}
