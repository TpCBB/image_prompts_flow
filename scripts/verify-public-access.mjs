import assert from 'node:assert/strict';

const site = new URL(process.argv[2] || process.env.SITE_URL || 'https://image-prompt-flow.vercel.app');
const database = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert(database && key, 'Provide the Supabase URL and an anonymous/publishable key; never use a service-role key');
const headers = { apikey: key };
if (!key.startsWith('sb_publishable_')) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  assert.equal(claims.role, 'anon', 'This check must use an anonymous key');
  headers.Authorization = `Bearer ${key}`;
}

async function get(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(25_000), cache: 'no-store' });
}

const homepage = await get(site);
assert.equal(homepage.status, 200, 'Homepage must load');
assert((await homepage.text()).includes('<article'), 'Homepage must render prompt cards instead of an error page');
for (const path of ['/api/prompts?limit=1', '/api/categories', '/api/tags']) {
  const response = await get(new URL(path, site));
  const body = await response.json();
  assert.equal(response.status, 200, `${path} must remain available`);
  assert.equal(body.success, true, `${path} must succeed`);
  assert(Array.isArray(body.data) && body.data.length > 0, `${path} must return actual data`);
  console.log(JSON.stringify({ check: 'website', path, status: response.status, items: body.data.length }));
}

const write = await get(new URL('/api/prompts', site), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
assert([401, 403].includes(write.status), 'Unauthenticated writes must be rejected');
console.log(JSON.stringify({ check: 'unauthorized-write', status: write.status }));

for (const table of ['prompts', 'tags', 'categories', 'gallery_prompts']) {
  const response = await get(new URL(`/rest/v1/${table}?select=id&limit=1`, database), { headers });
  const body = await response.json();
  assert([401, 403].includes(response.status), `${table}: anonymous access is still open`);
  assert.equal(body.code, '42501', `${table}: confirm a permission denial rather than an invalid key`);
  console.log(JSON.stringify({ check: 'anonymous-database-read', table, status: response.status, code: body.code }));
}
console.log('Website reads succeed; anonymous database reads and unauthenticated writes are blocked.');
