import type { Tag } from '@/types';

export function isNsfwLabel(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === 'nsfw';
}

export function isVisibleTag(tag: Tag): boolean {
  return ![tag.slug, tag.name_en, tag.name_zh].some(isNsfwLabel);
}
