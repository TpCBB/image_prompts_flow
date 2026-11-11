import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('deployment image origin', () => {
  it('uses only local assets when no host is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGE_BASE_URL', '');
    vi.resetModules();
    const { getImageUrl } = await import('@/lib/config');
    expect(getImageUrl('photo.jpg')).toBe('/photo.jpg');
    expect(getImageUrl(null)).toBe('/placeholder.svg');
  });

  it('uses the explicitly configured host and preserves full external URLs', async () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGE_BASE_URL', 'https://test-images.example///');
    vi.resetModules();
    const { getImageUrl } = await import('@/lib/config');
    expect(getImageUrl('photo.jpg')).toBe('https://test-images.example/photo.jpg');
    expect(getImageUrl('https://external.example/image.jpg')).toBe('https://external.example/image.jpg');
  });
});
