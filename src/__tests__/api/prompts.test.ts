// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/prompts/route';
import { GET as GET_DETAIL, PUT, DELETE } from '@/app/api/prompts/[id]/route';
import { resetCache } from '@/lib/cache';
import { queryFilterMetadata } from '@/lib/filter-data';

const { query, from } = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), neq: vi.fn(), not: vi.fn(), or: vi.fn(), contains: vi.fn(), order: vi.fn(), range: vi.fn(), abortSignal: vi.fn(), single: vi.fn() };
  return { query, from: vi.fn(() => query) };
});
vi.mock('@/lib/supabase', () => ({ supabase: { from } }));
vi.mock('@/lib/supabase-server', () => ({ getSupabaseAdmin: () => ({ from }) }));
vi.mock('@/lib/filter-data', () => ({ queryFilterMetadata: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  resetCache();
  for (const method of Object.values(query)) method.mockReturnValue(query);
  query.range.mockResolvedValue({ data: [], count: 0, error: null });
  query.single.mockResolvedValue({ data: { id: 1, title: 'Example' }, error: null });
  vi.mocked(queryFilterMetadata).mockResolvedValue({ categories: [], tagCounts: new Map(), hiddenDuplicateIds: [] });
  vi.stubEnv('ADMIN_API_TOKEN', 'test-admin-token');
});
afterEach(() => vi.unstubAllEnvs());
const request = (queryString: string) => new NextRequest(`http://localhost/api/prompts?${queryString}`);

describe('Prompt API', () => {
  it('excludes duplicate records before filtering and pagination', async () => {
    vi.mocked(queryFilterMetadata).mockResolvedValue({ categories: [], tagCounts: new Map(), hiddenDuplicateIds: [1009, 1010] });
    const response = await GET(request('page=2&limit=24&category=生活&search=修图'));
    expect(response.status).toBe(200);
    expect(query.not).toHaveBeenCalledWith('id', 'in', '(1009,1010)');
    expect(query.not.mock.invocationCallOrder[0]).toBeLessThan(query.range.mock.invocationCallOrder[0]);
    expect(query.range).toHaveBeenCalledWith(24, 47);
  });

  it.each(['page=0', 'page=-1', 'page=1abc', 'page=1.5', 'limit=0', 'limit=101', 'limit=NaN', 'page=9007199254740992', 'prompt_type=unknown', 'page=10000', `category=${'a'.repeat(101)}`, `tag=${'a'.repeat(101)}`])(
    'rejects invalid query %s before touching the database', async (queryString) => {
      expect((await GET(request(queryString))).status).toBe(400);
      expect(from).not.toHaveBeenCalled();
    }
  );

  it('defaults to image prompts, excludes NSFW and breaks timestamp ties using ID', async () => {
    expect((await GET(request(''))).status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith('prompt_type', 'image');
    expect(query.neq).toHaveBeenCalledWith('category', 'NSFW');
    expect(query.order.mock.calls).toEqual([
      ['created_at', { ascending: false }], ['id', { ascending: false }],
    ]);
    expect(query.range).toHaveBeenCalledWith(0, 23);
  });

  it('quotes reserved search characters and searches translated fields and author', async () => {
    const search = 'a,b).title.eq."x"';
    await GET(request(new URLSearchParams({ search }).toString()));
    const filter = query.or.mock.calls[0][0] as string;
    for (const column of ['title', 'prompt', 'title_en', 'prompt_en', 'author']) {
      expect(filter).toContain(`${column}.ilike.${JSON.stringify(`%${search}%`)}`);
    }
  });

  it('does not confuse cache keys when search text contains parameter syntax', async () => {
    await GET(request(new URLSearchParams({ search: 'x&tag=y' }).toString()));
    await GET(request(new URLSearchParams({ search: 'x', tag: 'y' }).toString()));
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('coalesces a burst of identical list requests into a single database query', async () => {
    const responses = await Promise.all(Array.from({ length: 20 }, () => GET(request(''))));
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(query.range).toHaveBeenCalledTimes(1);
  });

  it('does not cache a database failure or expose its internal message', async () => {
    query.range.mockResolvedValueOnce({ data: null, count: null, error: { message: 'private database detail' } });
    const response = await GET(request(''));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private database detail');
    expect((await GET(request(''))).status).toBe(200);
    expect(query.range).toHaveBeenCalledTimes(2);
  });

  it('caches and coalesces detail reads, including missing IDs', async () => {
    const detail = () => GET_DETAIL(request(''), { params: Promise.resolve({ id: '1' }) });
    const responses = await Promise.all(Array.from({ length: 20 }, detail));
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(query.single).toHaveBeenCalledTimes(1);
    query.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    for (let i = 0; i < 2; i++) {
      expect((await GET_DETAIL(request(''), { params: Promise.resolve({ id: '2' }) })).status).toBe(404);
    }
    expect(query.single).toHaveBeenCalledTimes(2);
  });

  it('blocks POST, PUT and DELETE without a token before database access', async () => {
    const req = new NextRequest('http://localhost/api/prompts', { method: 'POST' });
    const params = { params: Promise.resolve({ id: '1' }) };
    for (const handler of [() => POST(req), () => PUT(req, params), () => DELETE(req, params)]) {
      expect((await handler()).status).toBe(401);
    }
    expect(from).not.toHaveBeenCalled();
  });

  it('disables writes if no admin token is configured', async () => {
    vi.stubEnv('ADMIN_API_TOKEN', '');
    expect((await POST(request(''))).status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });

  it('accepts the configured token and proceeds to request validation', async () => {
    const req = new NextRequest('http://localhost/api/prompts', {
      method: 'POST', headers: { authorization: 'Bearer test-admin-token' }, body: '{}',
    });
    expect((await POST(req)).status).toBe(400);
  });
});
