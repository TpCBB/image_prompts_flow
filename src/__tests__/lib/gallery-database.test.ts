// @vitest-environment node
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getHiddenDuplicateIds } from '@/lib/preview-visibility';

const db = new PGlite();

beforeAll(async () => {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await db.exec(await readFile('supabase/schema.sql', 'utf8'));
  const migration = (await readdir('supabase/migrations')).find((name) => name.endsWith('_gallery_queries.sql'))!;
  await db.exec(await readFile(`supabase/migrations/${migration}`, 'utf8'));
  await db.exec(`INSERT INTO public.prompts(id,title,prompt,author,category,preview,tags)
    SELECT i, 'Title ' || i, 'Prompt ' || i, 'Author',
      CASE WHEN i=1100 THEN ' nsfw ' WHEN i=1001 THEN 'Photography' ELSE 'Design' END,
      CASE WHEN i IN (1,1001) THEN 'shared.jpg' ELSE i || '.jpg' END,
      ARRAY['nature','nature','nsfw'] FROM generate_series(1,1100) AS i;
    INSERT INTO public.prompts(id,title,prompt,author,category,preview,tags,prompt_type) VALUES
      (1101,'Functional','Write','Author','Work','shared.jpg',ARRAY['writing'],'functional'),
      (1102,'No preview','Draw','Author','Design',NULL,ARRAY['plain'],'image'),
      (1103,'Empty preview','Draw','Author','Design','',ARRAY['plain'],'image');`);
}, 30_000);

afterAll(async () => { if (!db.closed) await db.close(); });

describe('Gallery SQL', () => {
  it('preserves deterministic representatives and keeps functional or missing-image rows', async () => {
    const { rows } = await db.query<{ id: number; preview: string | null; prompt_type: string }>('SELECT id,preview,prompt_type FROM public.prompts');
    const hidden = new Set(getHiddenDuplicateIds(rows));
    const expected = rows.filter((row) => !hidden.has(row.id)).map((row) => row.id).sort((a,b) => a-b);
    const visible = await db.query<{ id: number }>('SELECT id FROM public.gallery_prompts ORDER BY id');
    expect(visible.rows.map((row) => row.id)).toEqual(expected);
    const duplicate = await db.query('SELECT id FROM public.gallery_prompts WHERE id IN (1,1001)');
    expect(duplicate.rows).toHaveLength(1);
  });

  it('aggregates more than 1000 rows with per-prompt unique tags and normalized NSFW filtering', async () => {
    const { rows } = await db.query<{ metadata: { tagCounts: Record<string, number>; categories: string[] } }>("SELECT public.gallery_filter_metadata('image') AS metadata");
    expect(rows[0].metadata.tagCounts.nature).toBe(1098);
    expect(rows[0].metadata.tagCounts.plain).toBe(2);
    expect(rows[0].metadata.tagCounts.nsfw).toBeUndefined();
    expect(rows[0].metadata.categories).not.toContain(' nsfw ');
    const functional = await db.query<{ metadata: { tagCounts: Record<string, number> } }>("SELECT public.gallery_filter_metadata('functional') AS metadata");
    expect(functional.rows[0].metadata.tagCounts).toEqual({ writing: 1 });
  });

  it('keeps the view and aggregate function inaccessible to anonymous visitors', async () => {
    const { rows } = await db.query<{ view_access: boolean; function_access: boolean; options: string[] }>(`SELECT
      has_table_privilege('anon','public.gallery_prompts','SELECT') AS view_access,
      has_function_privilege('anon','public.gallery_filter_metadata(text)','EXECUTE') AS function_access,
      (SELECT reloptions FROM pg_class WHERE oid='public.gallery_prompts'::regclass) AS options`);
    expect(rows[0]).toMatchObject({ view_access: false, function_access: false });
    expect(rows[0].options).toContain('security_invoker=true');
  });

  it('revokes legacy public reads while keeping server reads and every original row', async () => {
    await db.exec('GRANT SELECT ON public.prompts, public.tags, public.categories TO anon, authenticated;');
    const before = await db.query<{ count: number; allowed: boolean }>("SELECT (SELECT count(*)::int FROM public.prompts) AS count, has_table_privilege('anon','public.prompts','SELECT') AS allowed");
    expect(before.rows[0].allowed).toBe(true);
    const migration = (await readdir('supabase/migrations')).find((name) => name.endsWith('_close_direct_public_reads.sql'))!;
    await db.exec(await readFile(`supabase/migrations/${migration}`, 'utf8'));
    const access = await db.query<{ role: string; can_read: boolean }>(`SELECT r.role, has_table_privilege(r.role, 'public.' || t.name, 'SELECT') AS can_read
      FROM (VALUES ('anon'),('authenticated'),('service_role')) AS r(role)
      CROSS JOIN (VALUES ('prompts'),('tags'),('categories')) AS t(name)`);
    expect(access.rows.filter((row) => row.role !== 'service_role').every((row) => !row.can_read)).toBe(true);
    expect(access.rows.filter((row) => row.role === 'service_role').every((row) => row.can_read)).toBe(true);
    const after = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM public.prompts');
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });
});
