import manifest from './image-manifest.json';
import { IMAGE_BASE_URL } from './config';

interface ImageMetadata {
  width: number;
  height: number;
  variants: { path: string; width: number }[];
}

// Only enrich our own static assets. Third-party images keep their original URLs.
export function getImageMetadata(preview: string | null | undefined): ImageMetadata | undefined {
  if (!preview) return undefined;
  const key = preview.startsWith(`${IMAGE_BASE_URL}/`)
    ? preview.slice(IMAGE_BASE_URL.length + 1)
    : preview;
  return Object.prototype.hasOwnProperty.call(manifest, key)
    ? (manifest as Record<string, ImageMetadata>)[key]
    : undefined;
}
