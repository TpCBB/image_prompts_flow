import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { successResponse, ApiError } from '@/lib/api-response';
import { authorizeAdminRequest } from '@/lib/admin-auth';
import { getCache } from '@/lib/cache';
import { parsePositiveInteger } from '@/lib/prompt-query';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 获取单个提示词
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const numericId = parsePositiveInteger(id, 0);

  if (numericId === null) {
    return ApiError.BAD_REQUEST('无效的 ID');
  }

  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('id', numericId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return ApiError.NOT_FOUND('提示词不存在');
    }
    return ApiError.SERVER_ERROR(error.message);
  }

  return successResponse(data);
}

// 更新提示词
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const authError = authorizeAdminRequest(request);
  if (authError) return authError;
  const { id } = await params;
  const numericId = parsePositiveInteger(id, 0);

  if (numericId === null) {
    return ApiError.BAD_REQUEST('无效的 ID');
  }

  try {
    const body = await request.json();

    // 验证 mode 值（如果提供）
    if (body.mode && !['generate', 'edit'].includes(body.mode)) {
      return ApiError.BAD_REQUEST('mode 必须是 generate 或 edit');
    }

    // 构建更新对象，只包含提供的字段
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'title', 'title_en', 'preview', 'prompt', 'prompt_en',
      'author', 'link', 'mode', 'category', 'sub_category', 'tags'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return ApiError.BAD_REQUEST('没有提供要更新的字段');
    }

    const { data, error } = await getSupabaseAdmin()
      .from('prompts')
      .update(updateData)
      .eq('id', numericId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return ApiError.NOT_FOUND('提示词不存在');
      }
      return ApiError.SERVER_ERROR(error.message);
    }

    getCache().clear();
    return successResponse(data, '更新成功');
  } catch {
    return ApiError.BAD_REQUEST('请求体解析失败');
  }
}

// 删除提示词
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authError = authorizeAdminRequest(request);
  if (authError) return authError;
  const { id } = await params;
  const numericId = parsePositiveInteger(id, 0);

  if (numericId === null) {
    return ApiError.BAD_REQUEST('无效的 ID');
  }

  // 先检查是否存在
  const { data: existing } = await getSupabaseAdmin()
    .from('prompts')
    .select('id')
    .eq('id', numericId)
    .single();

  if (!existing) {
    return ApiError.NOT_FOUND('提示词不存在');
  }

  const { error } = await getSupabaseAdmin()
    .from('prompts')
    .delete()
    .eq('id', numericId);

  if (error) {
    return ApiError.SERVER_ERROR(error.message);
  }

  getCache().clear();
  return successResponse(null, '删除成功');
}
