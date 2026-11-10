-- Additive migration: original prompts and existing clients are unchanged.
-- Match the production SHA-256 representative selection before any filtering.
CREATE VIEW public.gallery_prompts
WITH (security_invoker = true)
AS
WITH candidates AS (
  SELECT id, CASE WHEN preview LIKE 'http://%' OR preview LIKE 'https://%'
    THEN preview ELSE 'https://image-prompts-flow-images.hsc28yo.workers.dev/' || preview END AS image_url
  FROM public.prompts
  WHERE prompt_type = 'image' AND preview IS NOT NULL AND preview <> ''
), ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY image_url
    ORDER BY sha256(convert_to('preview-selection-v1', 'UTF8') || decode('00', 'hex')
      || convert_to(image_url, 'UTF8') || decode('00', 'hex') || convert_to(id::text, 'UTF8')), id
  ) AS position
  FROM candidates
)
SELECT p.*, lower(btrim(p.category)) = 'nsfw' AS is_nsfw
FROM public.prompts p LEFT JOIN ranked r ON r.id = p.id
WHERE r.position IS NULL OR r.position = 1;

REVOKE ALL ON public.gallery_prompts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gallery_prompts TO service_role;

CREATE FUNCTION public.gallery_filter_metadata(p_prompt_type text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  WITH visible AS MATERIALIZED (
    SELECT category, tags FROM public.gallery_prompts
    WHERE NOT is_nsfw AND (p_prompt_type IS NULL OR prompt_type = p_prompt_type)
  ), categories AS (
    SELECT DISTINCT category FROM visible WHERE btrim(category) <> ''
  ), counts AS (
    SELECT label.slug, count(*) AS count
    FROM visible CROSS JOIN LATERAL (SELECT DISTINCT unnest(tags) AS slug) label
    WHERE label.slug IS NOT NULL AND lower(btrim(label.slug)) <> 'nsfw'
    GROUP BY label.slug
  )
  SELECT jsonb_build_object(
    'categories', coalesce((SELECT jsonb_agg(category ORDER BY category) FROM categories), '[]'::jsonb),
    'tagCounts', coalesce((SELECT jsonb_object_agg(slug, count) FROM counts), '{}'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.gallery_filter_metadata(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gallery_filter_metadata(text) TO service_role;

CREATE INDEX IF NOT EXISTS prompts_type_created_id_idx
  ON public.prompts(prompt_type, created_at DESC, id DESC);

NOTIFY pgrst, 'reload schema';
