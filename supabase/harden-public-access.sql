-- Existing projects: deploy the server-only reader and its service-role key,
-- then verify the site BEFORE applying this permission change. Older deployments
-- that still read with an anonymous key must be migrated first.
BEGIN;

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON TABLE public.prompts, public.categories, public.tags FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.prompts, public.categories, public.tags TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Rollback for older deployments (existing read policies are preserved):
-- GRANT SELECT ON TABLE public.prompts, public.categories, public.tags TO anon, authenticated;
-- NOTIFY pgrst, 'reload schema';
