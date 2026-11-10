import { errorResponse } from './api-response';

export class ReadCapacityError extends Error {}
let activeQueries = 0;

// Reject excess work instead of building an unbounded queue inside a function.
export async function runReadQuery<T>(query: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  if (activeQueries >= 8) throw new ReadCapacityError('Read capacity exceeded');
  activeQueries++;
  const signal = AbortSignal.timeout(8000);
  try {
    const result = await query(signal);
    if (signal.aborted) throw new ReadCapacityError('Database request timed out');
    return result;
  } finally {
    activeQueries--;
  }
}

export function readErrorResponse(error: unknown, message = '加载失败，请稍后再试') {
  if (error instanceof ReadCapacityError) {
    const response = errorResponse('服务繁忙，请稍后再试', 503);
    response.headers.set('Retry-After', '5');
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  return errorResponse(message, 500);
}
