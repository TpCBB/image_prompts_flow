import { NextRequest, NextResponse } from 'next/server';
import { consumeRules, type RateRule } from '@/lib/rate-limit';

// Canonicalize IPv4, aggregate IPv6 by /64, and reject arbitrary header text.
function normalizeIp(raw: string): string | null {
  if (raw.length > 128) return null;
  const ip = raw.trim();
  const parts = ip.split('.');
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) {
    return parts.map(Number).join('.');
  }
  try {
    const hostname = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    const [left, right] = hostname.split('::');
    const start = left ? left.split(':') : [];
    const end = right ? right.split(':') : [];
    const expanded = right !== undefined
      ? [...start, ...Array(8 - start.length - end.length).fill('0'), ...end]
      : start;
    if (expanded.length !== 8) return null;
    const words = expanded.map((word) => parseInt(word, 16));
    if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
      return [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join('.');
    }
    return `${words.slice(0, 4).map((word) => word.toString(16)).join(':')}::/64`;
  } catch {
    return null;
  }
}

export function clientIdentity(request: NextRequest): string {
  // Vercel controls these headers. Never trust arbitrary forwarding headers locally.
  if (process.env.VERCEL === '1') {
    return normalizeIp(request.headers.get('x-vercel-forwarded-for') ||
      request.headers.get('x-forwarded-for') || '') || 'unknown';
  }
  return 'local';
}

function denied(request: NextRequest, status: number, retryAfter: number) {
  const error = status === 429 ? '访问过于频繁，请稍后再试' : '服务繁忙，请稍后再试';
  const headers = { 'Cache-Control': 'private, no-store', 'Retry-After': String(retryAfter) };
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error }, { status, headers });
  }
  return new NextResponse(error, { status, headers });
}

export async function middleware(request: NextRequest) {
  // Keep unsupported verbs from reaching an expensive route or page render.
  const isApi = request.nextUrl.pathname.startsWith('/api/');
  const methods = isApi ? ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'] : ['GET', 'HEAD'];
  if (!methods.includes(request.method)) {
    return new NextResponse(null, { status: 405, headers: { Allow: methods.join(', ') } });
  }
  if (request.nextUrl.search.length > 2048) {
    return NextResponse.json({ success: false, error: '请求参数过长' }, {
      status: 414, headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  try {
    const identity = clientIdentity(request);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
    const visitor = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const prefix = `image-prompts:${process.env.VERCEL_ENV || 'local'}:v1`;
    const rule = (key: string, limit: number, windowMs = 60_000): RateRule => ({
      key: `${prefix}:${key}`, limit, windowMs,
    });
    const rules = [
      rule('global', 600),
      rule(`${visitor}:read`, 60),
      rule(`${visitor}:burst`, 15, 10_000),
    ];
    if (request.nextUrl.pathname === '/api/prompts' && request.nextUrl.searchParams.get('search')?.trim()) {
      rules.push(rule(`${visitor}:search`, 20), rule(`${visitor}:search-burst`, 5, 10_000));
    }
    if (!['GET', 'HEAD'].includes(request.method)) rules.push(rule(`${visitor}:write`, 10));

    const decision = await consumeRules(rules);
    if (!decision.allowed) return denied(request, 429, decision.retryAfter);
    return NextResponse.next();
  } catch {
    return denied(request, 503, 5);
  }
}

// Every page request is checked too. Static images/scripts do not consume quotas.
// Do not skip requests based on client-controlled prefetch headers.
export const config = { matcher: ['/', '/api/:path*'] };
