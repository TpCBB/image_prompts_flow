'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PromptsContainer from '@/components/PromptsContainer';
import { Prompt, Tag, PromptType } from '@/types';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import type { BrowseState } from '@/lib/browse-state';

interface PromptsContainerWrapperProps {
  initialPrompts: {
    data: Prompt[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  };
  initialTags: Tag[];
  initialCategories: string[];
  initialBrowseState?: BrowseState;
}

function ErrorFallback({ onReset }: { onReset?: () => void }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-red-500 dark:text-red-400" />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
        页面加载出错
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-md">
        抱歉，加载提示词时发生了错误。请尝试刷新页面或稍后再试。
      </p>
      <button
        onClick={() => {
          onReset?.();
          window.location.reload();
        }}
        className="flex items-center gap-2 px-6 py-3 rounded-xl
                  text-sm font-medium text-white
                  bg-gradient-to-r from-purple-500 to-pink-500
                  hover:from-purple-600 hover:to-pink-600
                  active:scale-[0.97]
                  transition-all duration-200
                  shadow-lg shadow-purple-500/25"
      >
        <RefreshCw className="w-4 h-4" />
        刷新页面
      </button>
    </div>
  );
}

export default function PromptsContainerWrapper({
  initialPrompts,
  initialTags,
  initialCategories,
  initialBrowseState,
}: PromptsContainerWrapperProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log error for debugging/monitoring
    console.error('PromptsContainer Error:', error);
    console.error('Error Info:', errorInfo);
  };

  return (
    <ErrorBoundary
      fallback={<ErrorFallback />}
      onError={handleError}
    >
      <PromptsContainer
        initialPrompts={initialPrompts}
        initialTags={initialTags}
        initialCategories={initialCategories}
        initialBrowseState={initialBrowseState}
      />
    </ErrorBoundary>
  );
}
