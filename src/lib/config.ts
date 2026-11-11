// Legacy identity used only by deterministic duplicate selection. Keep this in
// sync with the SQL gallery migration; it is never a default request origin.
export const IMAGE_CANONICAL_BASE_URL = 'https://image-prompts-flow-images.hsc28yo.workers.dev';
// Each deployment opts into its own image host; an unconfigured copy uses only
// its own public assets and cannot silently consume the production image host.
export const IMAGE_BASE_URL = (process.env.NEXT_PUBLIC_IMAGE_BASE_URL || '').trim().replace(/\/+$/, '');

// 获取完整图片 URL
export function getImageUrl(imagePath: string | null | undefined): string {
  // 如果为空，返回占位图
  if (!imagePath) {
    return "/placeholder.svg";
  }
  // 如果已经是完整 URL，直接返回
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  // 否则拼接 base URL
  return `${IMAGE_BASE_URL}/${imagePath}`;
}
