import { Suspense } from 'react';
import PromptsContainerWrapper from '@/components/PromptsContainerWrapper';
import { fetchPrompts, fetchTags, fetchCategories } from '@/lib/data';
import Loading from './loading';
import { getCache } from '@/lib/cache';
import { parseBrowseState } from '@/lib/browse-state';

// Failed renders must not become a cached "empty library". Data caches still
// coalesce successful reads, and middleware protects every page request.
export const dynamic = 'force-dynamic';

// 主页 - Server Component
// SSR 优势: SEO、更快的首屏渲染、减少客户端 JS
type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

async function PromptLibrary({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === 'string') params.set(key, value);
  const state = parseBrowseState(params);
  const filters = { page: 1, limit: 24, prompt_type: state.promptType, search: state.search.trim(), category: state.category || '', tag: state.tag || '' };
  
  // 服务端并行获取初始数据，传入 prompt_type 确保数据一致
  const [promptsResult, tags, categories] = await Promise.all([
    getCache().getOrLoad(`home-prompts:${JSON.stringify(filters)}`, () => fetchPrompts(filters)),
    fetchTags(state.promptType),
    fetchCategories(state.promptType),
  ]);

  return (
    <PromptsContainerWrapper
      initialPrompts={promptsResult}
      initialTags={tags}
      initialCategories={categories}
      initialBrowseState={state}
    />
  );
}

export default function Home({ searchParams }: { searchParams: PageSearchParams }) {
  return <Suspense fallback={<Loading />}><PromptLibrary searchParams={searchParams} /></Suspense>;
}
