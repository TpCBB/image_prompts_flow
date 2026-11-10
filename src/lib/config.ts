// 图片 CDN 域名配置
// 修改这里来切换图片源
export const IMAGE_BASE_URL = 'https://image-prompts-flow-images.hsc28yo.workers.dev';

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
