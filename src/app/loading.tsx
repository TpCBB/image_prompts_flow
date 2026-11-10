import { PromptCardSkeletonList } from '@/components/PromptCardSkeleton';

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="正在加载提示词" className="min-h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div role="status" className="text-sm text-gray-500 dark:text-gray-400 mb-6">正在加载提示词…</div>
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5">
        <PromptCardSkeletonList count={8} />
      </div>
    </main>
  );
}
