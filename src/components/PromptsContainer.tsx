"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Header from "@/components/Header";
import TagFilter from "@/components/TagFilter";
import CategoryFilter from "@/components/CategoryFilter";
import PromptCard from "@/components/PromptCard";
import PromptModal from "@/components/PromptModal";
import { PromptCardSkeletonList } from "@/components/PromptCardSkeleton";
import { Prompt, Tag, PromptType } from "@/types";
import { translations } from "@/lib/i18n";
import { useDebounce, useScrollDirection } from "@/hooks";
import type { PromptsResult } from "@/lib/data";
import { getApiClient } from "@/lib/api-client";
import { useToast } from "@/contexts/ToastContext";
import { isNsfwLabel } from "@/lib/content-visibility";
import { useBrowseState } from '@/hooks/useBrowseState';
import { DEFAULT_BROWSE_STATE, type BrowseState } from '@/lib/browse-state';

interface PromptsContainerProps {
  initialPrompts: PromptsResult;
  initialTags: Tag[];
  initialCategories: string[];
  initialBrowseState?: BrowseState;
}

export default function PromptsContainer({
  initialPrompts,
  initialTags,
  initialCategories,
  initialBrowseState = DEFAULT_BROWSE_STATE,
}: PromptsContainerProps) {
  const { state: browseState, update: updateBrowseState, closePrompt } = useBrowseState(initialBrowseState);
  const { lang, promptType, search: searchQuery, category: selectedCategory, tag: selectedTag } = browseState;
  const debouncedSearch = useDebounce(searchQuery, 300).trim();
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const { addToast } = useToast();
  const apiClient = useMemo(() => getApiClient(), []);
  const filteredInitialPrompts = useMemo(
    () => initialPrompts.data.filter((prompt) => !isNsfwLabel(prompt.category)),
    [initialPrompts.data]
  );
  // Each response owns its columns so pagination cannot rebalance earlier cards.
  const [promptPages, setPromptPages] = useState<Prompt[][]>([filteredInitialPrompts]);
  const prompts = useMemo(() => promptPages.flat(), [promptPages]);
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [totalCount, setTotalCount] = useState(initialPrompts.pagination.total);
  const [page, setPage] = useState(initialPrompts.pagination.page);
  const [hasMore, setHasMore] = useState(initialPrompts.pagination.hasMore);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const queryKey = JSON.stringify([promptType, debouncedSearch, selectedCategory, selectedTag]);
  const initialQueryKey = JSON.stringify([initialBrowseState.promptType, initialBrowseState.search.trim(), initialBrowseState.category, initialBrowseState.tag]);
  const latestQueryKey = useRef(queryKey);
  latestQueryKey.current = queryKey;

  const { scrollDirection, isAtTop } = useScrollDirection({ threshold: 10 });
  const isHeaderHidden = scrollDirection === "down" && !isAtTop;
  const t = translations[lang];
  // Language changes only update presentation; they do not repeat requests.
  const messagesRef = useRef(t);
  messagesRef.current = t;

  const fetchPrompts = useCallback(
    async (pageNum: number, append = false) => {
      // Ignore retries belonging to an earlier filter and repeated load-more clicks.
      if (latestQueryKey.current !== queryKey || (append && requestRef.current)) return;
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      const requestId = ++requestIdRef.current;
      const isCurrent = () => !controller.signal.aborted &&
        requestId === requestIdRef.current && latestQueryKey.current === queryKey;

      if (!append) {
        setPromptPages([]);
        setTotalCount(0);
        setHasMore(false);
      }
      setLoadError(false);
      setLoading(true);

      try {
        const response = await apiClient.get<Prompt[]>("/api/prompts", {
          params: {
            page: pageNum,
            limit: 24,
            prompt_type: promptType,
            search: debouncedSearch || undefined,
            category: selectedCategory || undefined,
            tag: selectedTag || undefined,
            excludeNsfw: true,
          },
          signal: controller.signal,
        });
        if (!isCurrent()) return;
        if (!response.success) throw new Error(response.error || messagesRef.current.loadError);

        const data = response.data || [];
        if (append) {
          setPromptPages((previous) => {
            const ids = new Set(previous.flat().map((prompt) => prompt.id));
            const nextPage = data.filter((prompt) => {
              if (ids.has(prompt.id)) return false;
              ids.add(prompt.id);
              return true;
            });
            return nextPage.length ? [...previous, nextPage] : previous;
          });
        } else {
          setPromptPages([data]);
        }
        setTotalCount(response.pagination?.total ?? 0);
        setHasMore(response.pagination?.hasMore ?? false);
        setPage(pageNum);
      } catch (error) {
        if (!isCurrent()) return;
        console.error("Failed to fetch prompts:", error);
        setLoadError(true);
        addToast({
          type: "error",
          message: messagesRef.current.loadError,
          action: {
            label: messagesRef.current.retry,
            onClick: () => { void fetchPrompts(pageNum, append); },
          },
        });
      } finally {
        if (isCurrent()) {
          requestRef.current = null;
          setLoading(false);
        }
      }
    },
    [apiClient, addToast, queryKey, promptType, debouncedSearch, selectedCategory, selectedTag]
  );

  useEffect(() => {
    if (promptType === initialBrowseState.promptType) {
      setTags(initialTags);
      setCategories(initialCategories);
      return;
    }

    const controller = new AbortController();
    setTags([]);
    setCategories([]);
    const fetchFilters = async () => {
      try {
        const options = { params: { prompt_type: promptType }, signal: controller.signal };
        const [tagsResponse, categoriesResponse] = await Promise.all([
          apiClient.get<Tag[]>("/api/tags", options),
          apiClient.get<string[]>("/api/categories", options),
        ]);
        if (controller.signal.aborted) return;
        if (!tagsResponse.success || !categoriesResponse.success) {
          throw new Error("Failed to fetch filters");
        }
        setTags(tagsResponse.data || []);
        setCategories(categoriesResponse.data || []);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch filters:", error);
        addToast({ type: "error", message: messagesRef.current.loadError });
      }
    };
    void fetchFilters();
    return () => controller.abort();
  }, [promptType, apiClient, addToast, initialTags, initialCategories, initialBrowseState.promptType]);

  useEffect(() => {
    if (queryKey === initialQueryKey) {
      setPromptPages([filteredInitialPrompts]);
      setTotalCount(initialPrompts.pagination.total);
      setHasMore(initialPrompts.pagination.hasMore);
      setPage(initialPrompts.pagination.page);
      setLoadError(false);
      setLoading(false);
    } else {
      void fetchPrompts(1);
    }
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
      requestIdRef.current += 1;
    };
  }, [fetchPrompts, queryKey, initialQueryKey,
    filteredInitialPrompts, initialPrompts.pagination]);

  useEffect(() => {
    const id = browseState.promptId;
    if (!id) { setSelectedPrompt(null); return; }
    const cached = prompts.find((prompt) => prompt.id === id);
    if (cached) { setSelectedPrompt(cached); return; }
    const controller = new AbortController();
    setSelectedPrompt(null);
    void apiClient.get<Prompt>(`/api/prompts/${id}`, { signal: controller.signal }).then((response) => {
      if (controller.signal.aborted) return;
      if (response.success && response.data) setSelectedPrompt(response.data);
      else addToast({ type: 'error', message: messagesRef.current.detailLoadError });
    });
    return () => controller.abort();
  }, [browseState.promptId, prompts, apiClient, addToast]);

  const handlePromptTypeChange = (nextType: PromptType) => {
    if (nextType === promptType) return;
    // Reset together so the new type is never requested with the old filters.
    updateBrowseState({ category: null, tag: null, promptType: nextType, promptId: null });
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) void fetchPrompts(page + 1, true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <Header
        lang={lang}
        onLangChange={(lang) => updateBrowseState({ lang })}
        searchQuery={searchQuery}
        onSearchChange={(search) => updateBrowseState({ search }, 'replace')}
        promptType={promptType}
        onPromptTypeChange={handlePromptTypeChange}
        isHidden={isHeaderHidden}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Category Filter */}
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onCategorySelect={(category) => updateBrowseState({ category })}
          lang={lang}
        />

        {/* Tag Filter */}
        <TagFilter
          tags={tags}
          selectedTag={selectedTag}
          onTagSelect={(tag) => updateBrowseState({ tag })}
          lang={lang}
        />

        {/* Results Count */}
        <div className="py-4 flex items-center justify-between">
          <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
            {t.promptCount.replace("{count}", totalCount.toString())}
          </span>
          {(searchQuery || selectedCategory || selectedTag) && <button onClick={() => updateBrowseState({ search: '', category: null, tag: null })} className="text-sm font-medium text-blue-600 dark:text-blue-400 px-2 py-1">{t.clearFilters}</button>}
        </div>

        {/* Prompts Grid */}
        {loading && prompts.length === 0 ? (
          // 加载中显示骨架屏，体验更丝滑
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5">
            <PromptCardSkeletonList count={12} />
          </div>
        ) : prompts.length > 0 ? (
          <>
            {/* Append whole batches below existing columns, keeping cards mounted. */}
            <div key={queryKey} className="space-y-5">
              {promptPages.map((promptPage, index) => (
                <div
                  key={index}
                  data-prompt-page={index + 1}
                  className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5 flow-root"
                >
                  {promptPage.map((prompt) => (
                    <PromptCard
                      key={prompt.id}
                      prompt={prompt}
                      lang={lang}
                      onClick={() => { setSelectedPrompt(prompt); updateBrowseState({ promptId: prompt.id }); }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center py-12">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="glass-button px-8 py-3.5 rounded-2xl text-[14px] font-medium
                            bg-white/70 dark:bg-white/10 backdrop-blur-xl
                            text-gray-800 dark:text-white
                            border border-white/50 dark:border-white/20
                            shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_20px_rgba(0,0,0,0.1)]
                            hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_30px_rgba(0,0,0,0.15)]
                            hover:-translate-y-1 hover:bg-white/90 dark:hover:bg-white/20
                            active:scale-[0.97]
                            transition-all duration-300 ease-out
                            disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t.loading : t.loadMore}
                </button>
              </div>
            )}
          </>
        ) : loadError ? (
          <div role="alert" className="flex flex-col items-center gap-4 py-20 text-gray-500 dark:text-gray-400">
            <p>{t.loadError}</p>
            <button onClick={() => { void fetchPrompts(1); }} className="px-5 py-2 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900">
              {t.retry}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
            <p className="text-lg">{t.noResults}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[13px] text-gray-400 dark:text-gray-500 font-medium">
            AI Image Prompts Library
          </p>
        </div>
      </footer>

      {/* Prompt Detail Modal */}
      {selectedPrompt && (
        <PromptModal
          prompt={selectedPrompt}
          lang={lang}
          onClose={() => { setSelectedPrompt(null); closePrompt(); }}
        />
      )}
    </div>
  );
}
