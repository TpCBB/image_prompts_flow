'use client';

import { useId, useState } from 'react';
import { Tag, Language } from '@/types';
import { translations } from '@/lib/i18n';
import { isVisibleTag } from '@/lib/content-visibility';

interface TagFilterProps {
  tags: Tag[];
  selectedTag: string | null;
  onTagSelect: (tagSlug: string | null) => void;
  lang: Language;
}

export default function TagFilter({
  tags,
  selectedTag,
  onTagSelect,
  lang,
}: TagFilterProps) {
  const t = translations[lang];
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const tagsId = useId();
  const visibleTags = tags.filter(isVisibleTag);
  const needle = query.trim().toLocaleLowerCase();
  const displayedTags = expanded
    ? visibleTags.filter((tag) => `${tag.name_zh} ${tag.name_en} ${tag.slug}`.toLocaleLowerCase().includes(needle))
    : visibleTags.filter((tag, index) => index < 15 || tag.slug === selectedTag);

  return (
    <section aria-label={t.allTags} className="py-3">
      {expanded && <input type="search" aria-label={t.searchTags} placeholder={t.searchTags} value={query} onChange={(event) => setQuery(event.target.value)} className="mb-3 w-full sm:max-w-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900 px-3 py-2 text-sm" />}
      <div id={tagsId} className="flex flex-wrap gap-2">
      <button
        onClick={() => onTagSelect(null)}
        aria-pressed={selectedTag === null}
        className={`px-4 py-2 rounded-xl text-[13px] font-medium
                   backdrop-blur-md border
                   transition-all duration-200 active:scale-[0.97] ${
          selectedTag === null
            ? 'bg-white/80 dark:bg-white/15 text-gray-900 dark:text-white border-white/60 dark:border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_8px_rgba(0,0,0,0.08)]'
            : 'bg-white/40 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-white/30 dark:border-white/10 hover:bg-white/60 dark:hover:bg-white/10'
        }`}
      >
        {t.allTags}
      </button>
      {displayedTags.map((tag, index) => (
        <button
          key={tag.id}
          onClick={() => onTagSelect(tag.slug)}
          aria-pressed={selectedTag === tag.slug}
          className={`${!expanded && index >= 5 && tag.slug !== selectedTag ? 'hidden sm:inline-flex' : 'inline-flex'} items-center px-4 py-2 rounded-xl text-[13px] font-medium
                     backdrop-blur-md border
                     transition-all duration-200 active:scale-[0.97] ${
            selectedTag === tag.slug
              ? 'bg-white/80 dark:bg-white/15 text-gray-900 dark:text-white border-white/60 dark:border-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_8px_rgba(0,0,0,0.08)]'
              : 'bg-white/40 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-white/30 dark:border-white/10 hover:bg-white/60 dark:hover:bg-white/10'
          }`}
        >
          {lang === 'zh' ? tag.name_zh : tag.name_en}
          <span className="ml-1.5 text-[11px] opacity-60">({tag.count})</span>
        </button>
      ))}
      </div>
      {expanded && displayedTags.length === 0 && <p className="py-2 text-sm text-gray-500">{t.noTags}</p>}
      {visibleTags.length > 5 && <button type="button" aria-expanded={expanded} aria-controls={tagsId} onClick={() => { setExpanded(!expanded); setQuery(''); }} className={`${visibleTags.length <= 15 ? 'sm:hidden' : ''} mt-3 px-2 py-1 text-sm font-medium text-blue-600 dark:text-blue-400`}>{expanded ? t.collapseTags : t.expandTags.replace('{count}', String(visibleTags.length))}</button>}
    </section>
  );
}
