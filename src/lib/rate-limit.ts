// Edge-compatible: the same atomic rules work in middleware and across Vercel instances.
export interface RateRule {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateDecision {
  allowed: boolean;
  retryAfter: number;
}

export class LimiterUnavailable extends Error {}

const MAX_BUCKETS = 10_000;
const buckets = new Map<string, { count: number; expiresAt: number }>();

// Check every budget before incrementing any of them. A rejected request never
// extends a ban. Expiry is measured by Redis, independently of instance clocks.
const SCRIPT = `
local retry = 0
for i, key in ipairs(KEYS) do
  if tonumber(redis.call('GET', key) or '0') >= tonumber(ARGV[i * 2 - 1]) then
    retry = math.max(retry, redis.call('PTTL', key))
  end
end
if retry > 0 then return {0, retry} end
for i, key in ipairs(KEYS) do
  local count = redis.call('INCR', key)
  if count == 1 then redis.call('PEXPIRE', key, ARGV[i * 2]) end
end
return {1, 0}
`;

export function consumeMemoryRules(rules: RateRule[], now = Date.now()): RateDecision {
  let retryMs = 0;
  for (const rule of rules) {
    const bucket = buckets.get(rule.key);
    if (bucket && bucket.expiresAt > now && bucket.count >= rule.limit) {
      retryMs = Math.max(retryMs, bucket.expiresAt - now);
    }
  }
  if (retryMs) return { allowed: false, retryAfter: Math.ceil(retryMs / 1000) };

  if (buckets.size + rules.length > MAX_BUCKETS) {
    for (const [key, bucket] of buckets) {
      if (bucket.expiresAt <= now) buckets.delete(key);
    }
    const newKeys = rules.filter((rule) => !buckets.has(rule.key)).length;
    // Never evict active counters: an attacker could otherwise reset their limit.
    if (buckets.size + newKeys > MAX_BUCKETS) throw new LimiterUnavailable('Limiter at capacity');
  }
  for (const rule of rules) {
    const bucket = buckets.get(rule.key);
    if (bucket && bucket.expiresAt > now) bucket.count++;
    else buckets.set(rule.key, { count: 1, expiresAt: now + rule.windowMs });
  }
  return { allowed: true, retryAfter: 0 };
}

export async function consumeRules(rules: RateRule[]): Promise<RateDecision> {
  // The Vercel Marketplace integration manages/rotates KV_* credentials.
  // Explicit Upstash configuration takes precedence as a complete pair.
  const hasExplicitUpstash = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_TOKEN);
  const url = hasExplicitUpstash ? process.env.UPSTASH_REDIS_REST_URL : process.env.KV_REST_API_URL;
  const token = hasExplicitUpstash ? process.env.UPSTASH_REDIS_REST_TOKEN : process.env.KV_REST_API_TOKEN;
  if (!url && !token) {
    // Production on Vercel must not silently fall back to independent counters.
    if (process.env.VERCEL_ENV === 'production') {
      throw new LimiterUnavailable('Production requires shared rate limiting');
    }
    return consumeMemoryRules(rules);
  }
  if (!url || !token || !url.startsWith('https://')) {
    throw new LimiterUnavailable('Invalid Redis configuration');
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(['EVAL', SCRIPT, rules.length, ...rules.map((rule) => rule.key),
        ...rules.flatMap((rule) => [rule.limit, rule.windowMs])]),
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) throw new Error('Redis request failed');
    const body: { result?: unknown; error?: string } = await response.json();
    const result = body.result;
    if (body.error || !Array.isArray(result) || result.length !== 2 ||
        ![0, 1].includes(result[0]) || typeof result[1] !== 'number' ||
        !Number.isFinite(result[1]) || result[1] < 0) {
      throw new Error('Invalid Redis response');
    }
    return { allowed: result[0] === 1, retryAfter: Math.max(1, Math.ceil(result[1] / 1000)) };
  } catch {
    // An outage must not turn off protection and send unlimited traffic to SQL.
    throw new LimiterUnavailable('Shared rate limiter unavailable');
  }
}

export function resetRateLimits(): void {
  buckets.clear();
}
