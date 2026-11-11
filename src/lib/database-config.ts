type Environment = Record<string, string | undefined>;

// Preview credentials are deliberately separate: never fall back to the
// production/local pair, even when both sets are present in a deployment.
export function getServerDatabaseConfig(env: Environment) {
  const preview = env.VERCEL_ENV === 'preview';
  const url = preview
    ? env.PREVIEW_SUPABASE_URL?.trim()
    : (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = preview
    ? env.PREVIEW_SUPABASE_SERVICE_ROLE_KEY?.trim()
    : env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(preview
      ? 'Preview is disabled: configure PREVIEW_SUPABASE_URL and PREVIEW_SUPABASE_SERVICE_ROLE_KEY for a separate test database.'
      : 'Missing server-side Supabase configuration');
  }

  if (preview) {
    const normalizedUrl = url.replace(/\/+$/, '');
    const sharedUrls = [env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL];
    if (sharedUrls.some(value => value?.trim().replace(/\/+$/, '') === normalizedUrl)
      || key === env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      throw new Error('Preview must use its own database and credentials, separate from the shared configuration.');
    }
  }

  return { url, key };
}
