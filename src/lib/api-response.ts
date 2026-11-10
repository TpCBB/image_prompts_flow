import { NextResponse } from 'next/server';

// 统一 API 响应格式
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 成功响应 - 始终返回 200，直接展开 data 对象到顶层
export function successResponse<T extends Record<string, unknown>>(data: T, message?: string): NextResponse;
export function successResponse<T>(data: T, message?: string): NextResponse;
export function successResponse<T>(data: T, message?: string) {
  // 如果 data 是对象且包含 data/pagination 等字段，直接展开到顶层
  const response: Record<string, unknown> = { success: true };
  
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    Object.assign(response, data);
  } else {
    response.data = data;
  }
  
  if (message) {
    response.message = message;
  }
  
  return NextResponse.json(response);
}

// 错误响应 - 根据错误类型返回对应状态码
export function errorResponse(error: string, status: number = 500) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status, headers: { 'Cache-Control': 'private, no-store' } }
  );
}

// 常用错误
export const ApiError = {
  BAD_REQUEST: (msg = '请求参数错误') => errorResponse(msg, 400),
  UNAUTHORIZED: (msg = '未授权') => errorResponse(msg, 401),
  FORBIDDEN: (msg = '禁止访问') => errorResponse(msg, 403),
  NOT_FOUND: (msg = '资源不存在') => errorResponse(msg, 404),
  SERVER_ERROR: (msg = '服务器错误') => errorResponse(msg, 500),
};
