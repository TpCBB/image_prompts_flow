'use client';

export default function ErrorPage() {
  return (
    <main className="min-h-[80vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div role="alert">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">提示词暂时加载失败</h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">请检查网络后重试，你的筛选条件会保留。</p>
      </div>
      <button onClick={() => window.location.reload()} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">重新加载</button>
    </main>
  );
}
