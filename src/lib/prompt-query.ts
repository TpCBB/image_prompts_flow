// Quote PostgREST values so commas, parentheses and quotes remain search text.
// Escape SQL LIKE metacharacters as well; * retains PostgREST wildcard semantics.
export function buildSearchFilter(search: string): string {
  const literal = search.replace(/[\\%_]/g, '\\$&');
  const pattern = JSON.stringify(`%${literal}%`);
  return ['title', 'prompt', 'title_en', 'prompt_en', 'author']
    .map((column) => `${column}.ilike.${pattern}`)
    .join(',');
}

export function parsePositiveInteger(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
