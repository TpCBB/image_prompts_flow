import type { Language, PromptType } from '@/types';

export interface BrowseState {
  lang: Language;
  promptType: PromptType;
  search: string;
  category: string | null;
  tag: string | null;
  promptId: number | null;
}

export const DEFAULT_BROWSE_STATE: BrowseState = { lang: 'zh', promptType: 'image', search: '', category: null, tag: null, promptId: null };

export function parseBrowseState(params: URLSearchParams): BrowseState {
  const id = params.get('prompt');
  const promptId = id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) ? Number(id) : null;
  return {
    lang: params.get('lang') === 'en' ? 'en' : 'zh',
    promptType: params.get('type') === 'functional' ? 'functional' : 'image',
    search: (params.get('search') || '').slice(0, 200),
    category: params.get('category')?.slice(0, 100) || null,
    tag: params.get('tag')?.slice(0, 100) || null,
    promptId,
  };
}

export function browseUrl(href: string, state: BrowseState): string {
  const url = new URL(href);
  const values = { lang: state.lang === 'en' ? 'en' : null, type: state.promptType === 'functional' ? 'functional' : null,
    search: state.search || null, category: state.category, tag: state.tag, prompt: state.promptId ? String(state.promptId) : null };
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function promptShareUrl(href: string, promptId: number): string {
  const url = new URL(href);
  url.searchParams.set('prompt', String(promptId));
  url.hash = '';
  return url.href;
}
