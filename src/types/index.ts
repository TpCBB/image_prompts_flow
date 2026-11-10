export type PromptType = 'image' | 'functional';

export interface Prompt {
  id: number;
  title: string;
  title_en?: string | null;
  preview?: string | null;
  preview_width?: number;
  preview_height?: number;
  preview_variants?: { path: string; width: number }[];
  prompt: string;
  prompt_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  author: string;
  link?: string | null;
  mode: 'generate' | 'edit';
  category: string;
  sub_category?: string | null;
  created_at: string;
  tags?: string[] | null;
  prompt_type: PromptType;
  use_cases?: string[] | null;
}

export interface DbPrompt {
  id: number;
  title: string;
  title_en?: string | null;
  preview?: string | null;
  prompt: string;
  prompt_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  author: string;
  link?: string | null;
  mode: string;
  category: string;
  sub_category?: string | null;
  created_at?: string | null;
  tags?: string[] | null;
  prompt_type?: string | null;
  use_cases?: string[] | null;
}

export interface Tag {
  id: string;
  name_zh: string;
  name_en: string;
  slug: string;
  count: number;
}

export type Language = 'zh' | 'en';
