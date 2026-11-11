import { describe, expect, it } from 'vitest';
import { getServerDatabaseConfig } from '@/lib/database-config';

const production = {
  SUPABASE_URL: 'https://production.example',
  SUPABASE_SERVICE_ROLE_KEY: 'production-secret-placeholder',
};
const testDatabase = {
  PREVIEW_SUPABASE_URL: 'https://test.example',
  PREVIEW_SUPABASE_SERVICE_ROLE_KEY: 'test-secret-placeholder',
};

describe('server database environment isolation', () => {
  it('preserves production configuration even when preview values exist', () => {
    expect(getServerDatabaseConfig({ VERCEL_ENV: 'production', ...production, ...testDatabase }))
      .toEqual({ url: production.SUPABASE_URL, key: production.SUPABASE_SERVICE_ROLE_KEY });
  });

  it('supports the legacy local URL configuration', () => {
    expect(getServerDatabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: production.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: production.SUPABASE_SERVICE_ROLE_KEY,
    })).toEqual({ url: production.SUPABASE_URL, key: production.SUPABASE_SERVICE_ROLE_KEY });
  });

  it.each([
    {},
    production,
    { ...production, PREVIEW_SUPABASE_URL: testDatabase.PREVIEW_SUPABASE_URL },
    { ...production, PREVIEW_SUPABASE_SERVICE_ROLE_KEY: testDatabase.PREVIEW_SUPABASE_SERVICE_ROLE_KEY },
    { ...production, NEXT_PUBLIC_SUPABASE_URL: production.SUPABASE_URL },
    { ...testDatabase, PREVIEW_SUPABASE_SERVICE_ROLE_KEY: '   ' },
  ])('disables previews with missing credentials without falling back: %j', env => {
    expect(() => getServerDatabaseConfig({ VERCEL_ENV: 'preview', ...env }))
      .toThrow('Preview is disabled');
  });

  it('uses only the separate test pair in a preview', () => {
    expect(getServerDatabaseConfig({ VERCEL_ENV: 'preview', ...production, ...testDatabase }))
      .toEqual({ url: testDatabase.PREVIEW_SUPABASE_URL, key: testDatabase.PREVIEW_SUPABASE_SERVICE_ROLE_KEY });
  });

  it.each([
    { ...testDatabase, PREVIEW_SUPABASE_URL: ` ${production.SUPABASE_URL}/ ` },
    { ...testDatabase, PREVIEW_SUPABASE_SERVICE_ROLE_KEY: production.SUPABASE_SERVICE_ROLE_KEY },
    { ...testDatabase, NEXT_PUBLIC_SUPABASE_URL: testDatabase.PREVIEW_SUPABASE_URL },
  ])('rejects a test pair that reuses shared production configuration: %j', env => {
    expect(() => getServerDatabaseConfig({ VERCEL_ENV: 'preview', ...production, ...env }))
      .toThrow('Preview must use its own database');
  });

  it('does not expose credential values in configuration errors', () => {
    expect(() => getServerDatabaseConfig({ VERCEL_ENV: 'preview', ...production }))
      .toThrow(/^Preview is disabled:/);
    expect(() => getServerDatabaseConfig({ VERCEL_ENV: 'production' }))
      .toThrow('Missing server-side Supabase configuration');
  });
});
