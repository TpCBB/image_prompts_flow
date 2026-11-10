import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { successResponse, ApiError } from "@/lib/api-response";
import { getCache } from "@/lib/cache";
import { parsePositiveInteger } from "@/lib/prompt-query";
import { authorizeAdminRequest } from "@/lib/admin-auth";
import { fetchPrompts } from "@/lib/data";
import type { PromptType } from "@/types";
import { readErrorResponse } from "@/lib/read-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 获取查询参数
    const search = (searchParams.get("search") || "").trim();
    const category = searchParams.get("category") || "";
    const tag = searchParams.get("tag") || "";
    const promptType = searchParams.get("prompt_type") || "image";
    const excludeNsfw = searchParams.get("excludeNsfw") !== "false";
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = parsePositiveInteger(searchParams.get("limit"), 24);
    if (page === null || limit === null || limit > 100 || !Number.isSafeInteger(page * limit)) {
      return ApiError.BAD_REQUEST("page 必须是正整数，limit 必须为 1–100");
    }
    if (!["image", "functional"].includes(promptType)) {
      return ApiError.BAD_REQUEST("prompt_type 必须是 image 或 functional");
    }
    if (search.length > 200) {
      return ApiError.BAD_REQUEST("搜索内容不能超过 200 个字符");
    }
    const offset = (page - 1) * limit;
    if (offset > 10_000) return ApiError.BAD_REQUEST("翻页范围过大，请使用搜索或筛选缩小范围");
    if (category.length > 100 || tag.length > 100) return ApiError.BAD_REQUEST("筛选条件不能超过 100 个字符");

    const result = await fetchPrompts({ search, category, tag, page, limit, excludeNsfw, prompt_type: promptType as PromptType });

    return successResponse(result);
  } catch (err) {
    console.error("API /api/prompts error:", err);
    return readErrorResponse(err);
  }
}

// 创建新提示词
export async function POST(request: NextRequest) {
  const authError = authorizeAdminRequest(request);
  if (authError) return authError;

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

    const { data, error } = await getSupabaseAdmin()
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
