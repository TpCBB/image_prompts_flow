import { Suspense } from 'react';
import PromptsContainerWrapper from '@/components/PromptsContainerWrapper';
import { fetchPrompts, fetchTags, fetchCategories } from '@/lib/data';
import Loading from './loading';
import { getCache } from '@/lib/cache';

// Failed renders must not become a cached "empty library". Data caches still
// coalesce successful reads, and middleware protects every page request.
export const dynamic = 'force-dynamic';

// 主页 - Server Component
// SSR 优势: SEO、更快的首屏渲染、减少客户端 JS
async function PromptLibrary() {
  // 默认 prompt_type 为 'image'
  const defaultPromptType = 'image';
  
  // 服务端并行获取初始数据，传入 prompt_type 确保数据一致
  const [promptsResult, tags, categories] = await Promise.all([
    getCache().getOrLoad('home-prompts:image', () => fetchPrompts({ page: 1, limit: 24, prompt_type: defaultPromptType })),
    fetchTags(defaultPromptType),
    fetchCategories(defaultPromptType),
  ]);

  return (
    <PromptsContainerWrapper
      initialPrompts={promptsResult}
      initialTags={tags}
      initialCategories={categories}
    />
  );
}

export default function Home() {
  return <Suspense fallback={<Loading />}><PromptLibrary /></Suspense>;
}
