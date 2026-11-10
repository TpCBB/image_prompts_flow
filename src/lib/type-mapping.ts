import { DbPrompt, Prompt, PromptType } from '@/types';
import { getImageMetadata } from './image-metadata';

/**
 * Maps a database prompt record to the frontend Prompt interface.
 * Handles null/undefined values safely and ensures type consistency.
 */
export function mapDbPromptToPrompt(dbPrompt: DbPrompt): Prompt {
  const image = getImageMetadata(dbPrompt.preview);
  const validModes = ['generate', 'edit'] as const;
  const validPromptTypes = ['image', 'functional'] as const;

  const mode = validModes.includes(dbPrompt.mode as typeof validModes[number])
    ? (dbPrompt.mode as 'generate' | 'edit')
    : 'generate';

  const promptType = validPromptTypes.includes(dbPrompt.prompt_type as typeof validPromptTypes[number])
    ? (dbPrompt.prompt_type as PromptType)
    : 'image';

  return {
    id: dbPrompt.id,
    title: dbPrompt.title,
    title_en: dbPrompt.title_en ?? null,
    preview: dbPrompt.preview ?? null,
    ...(image ? { preview_width: image.width, preview_height: image.height, preview_variants: image.variants } : {}),
    prompt: dbPrompt.prompt,
    prompt_en: dbPrompt.prompt_en ?? null,
    description: dbPrompt.description ?? null,
    description_en: dbPrompt.description_en ?? null,
    author: dbPrompt.author,
    link: dbPrompt.link ?? null,
    mode,
    category: dbPrompt.category,
    sub_category: dbPrompt.sub_category ?? null,
    created_at: dbPrompt.created_at ?? new Date().toISOString(),
    tags: dbPrompt.tags ?? null,
    prompt_type: promptType,
    use_cases: dbPrompt.use_cases ?? null,
  };
}

/**
 * Safely access optional string field with fallback
 */
export function safeString(value: string | null | undefined, fallback: string = ''): string {
  return value ?? fallback;
}

/**
 * Safely access optional array field with fallback
 */
export function safeArray<T>(value: T[] | null | undefined, fallback: T[] = []): T[] {
  return value ?? fallback;
}
