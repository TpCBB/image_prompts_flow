import { timingSafeEqual } from 'node:crypto';
import { ApiError } from './api-response';

// Write endpoints stay disabled until a server-only token is configured.
export function authorizeAdminRequest(request: Request) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return ApiError.FORBIDDEN('管理写入功能未启用');

  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const provided = Buffer.from(token);
  const secret = Buffer.from(expected);
  if (provided.length !== secret.length || !timingSafeEqual(provided, secret)) {
    return ApiError.UNAUTHORIZED('需要有效的管理令牌');
  }
  return null;
}
