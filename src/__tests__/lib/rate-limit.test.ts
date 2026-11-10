// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeMemoryRules, consumeRules, resetRateLimits, LimiterUnavailable } from '@/lib/rate-limit';
import { clientIdentity, middleware } from '@/middleware';
import { NextRequest } from 'next/server';

beforeEach(() => {
  resetRateLimits();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  vi.stubEnv('KV_REST_API_URL', '');
  vi.stubEnv('KV_REST_API_TOKEN', '');
  vi.stubEnv('VERCEL_ENV', '');
  vi.stubEnv('VERCEL', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Abuse protection', () => {
  it('checks all budgets atomically and does not prolong a blocked window', () => {
    const general = { key: 'general', limit: 2, windowMs: 60_000 };
    const search = { key: 'search', limit: 1, windowMs: 60_000 };
    expect(consumeMemoryRules([general, search], 0).allowed).toBe(true);
    expect(consumeMemoryRules([general, search], 1000)).toEqual({ allowed: false, retryAfter: 59 });
    expect(consumeMemoryRules([general], 2000).allowed).toBe(true);
    expect(consumeMemoryRules([general], 59_000).retryAfter).toBe(1);
    expect(consumeMemoryRules([general, search], 60_000).allowed).toBe(true);
  });

  it('does not evict active limits when an attacker fills the counter store', () => {
    for (let i = 0; i < 10_000; i++) {
      consumeMemoryRules([{ key: String(i), limit: 1, windowMs: 60_000 }], 0);
    }
    expect(() => consumeMemoryRules([{ key: 'new', limit: 1, windowMs: 60_000 }], 1)).toThrow(LimiterUnavailable);
    expect(consumeMemoryRules([{ key: '0', limit: 1, windowMs: 60_000 }], 1).allowed).toBe(false);
    expect(consumeMemoryRules([{ key: 'new', limit: 1, windowMs: 60_000 }], 60_000).allowed).toBe(true);
  });

  it('uses a single shared atomic Redis command and interprets its retry time', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.com');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'secret');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: [0, 1201] })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await consumeRules([{ key: 'visitor', limit: 60, windowMs: 60_000 }]))
      .toEqual({ allowed: false, retryAfter: 2 });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body[0]).toBe('EVAL');
    expect(body.slice(2)).toEqual([1, 'visitor', 60, 60_000]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the native Marketplace credentials without mixing incomplete credential pairs', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('KV_REST_API_URL', 'https://marketplace.example.com');
    vi.stubEnv('KV_REST_API_TOKEN', 'marketplace-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: [1, 0] })));
    vi.stubGlobal('fetch', fetchMock);
    expect((await consumeRules([{ key: 'visitor', limit: 60, windowMs: 60_000 }])).allowed).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('https://marketplace.example.com');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://explicit.example.com');
    await expect(consumeRules([{ key: 'visitor', limit: 60, windowMs: 60_000 }])).rejects.toThrow(LimiterUnavailable);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { error: 'Redis error' }, { result: 'invalid' }, { result: [2, 0] }, { result: [0, -1] },
  ])('fails closed on a Redis error or invalid result: %j', async (body) => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.com');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    await expect(consumeRules([{ key: 'visitor', limit: 60, windowMs: 60_000 }])).rejects.toThrow(LimiterUnavailable);
  });

  it('requires shared counters in Vercel production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await middleware(new NextRequest('http://localhost/api/prompts'))).status).toBe(503);
  });

  it('ignores forwarding headers outside Vercel and groups IPv6 by prefix', () => {
    const request = (ip: string) => new NextRequest('http://localhost/', { headers: { 'x-forwarded-for': ip } });
    expect(clientIdentity(request('1.2.3.4'))).toBe('local');
    vi.stubEnv('VERCEL', '1');
    expect(clientIdentity(request('1.2.3.4'))).toBe('1.2.3.4');
    expect(clientIdentity(request('2001:db8:1:2::1'))).toBe(clientIdentity(request('2001:db8:1:2::ffff')));
    expect(clientIdentity(request('::ffff:1.2.3.4'))).toBe('1.2.3.4');
    expect(clientIdentity(request('1.2.3.4, 5.6.7.8'))).toBe('unknown');
    const spoofed = new NextRequest('http://localhost/', { headers: {
      'x-vercel-forwarded-for': '1.2.3.4', 'x-forwarded-for': '5.6.7.8',
    } });
    expect(clientIdentity(spoofed)).toBe('1.2.3.4');
  });

  it('limits changing search terms together and sends uncached 429 responses', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await middleware(new NextRequest(`http://localhost/api/prompts?search=${i}`))).status).toBe(200);
    }
    const blocked = await middleware(new NextRequest('http://localhost/api/prompts?search=different'));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(blocked.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await blocked.json()).toMatchObject({ success: false });
  });

  it('limits HEAD and prefetch-marked requests too, while another visitor can browse', async () => {
    vi.stubEnv('VERCEL', '1');
    for (let i = 0; i < 15; i++) {
      expect((await middleware(new NextRequest('http://localhost/', {
        method: 'HEAD', headers: { 'x-forwarded-for': '1.2.3.4', 'next-router-prefetch': '1' },
      }))).status).toBe(200);
    }
    expect((await middleware(new NextRequest('http://localhost/', { headers: { 'x-forwarded-for': '1.2.3.4' } }))).status).toBe(429);
    expect((await middleware(new NextRequest('http://localhost/', { headers: { 'x-forwarded-for': '1.2.3.5' } }))).status).toBe(200);
  });

  it('rejects excessive URL sizes before doing any remote work', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await middleware(new NextRequest(`http://localhost/api/prompts?search=${'a'.repeat(2100)}`))).status).toBe(414);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
