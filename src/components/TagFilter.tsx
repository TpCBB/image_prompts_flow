'use client';

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

  return (
    <div className="flex flex-wrap gap-2 py-3">
      <button
        onClick={() => onTagSelect(null)}
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
      {tags.filter(isVisibleTag).slice(0, 15).map((tag) => (
        <button
          key={tag.id}
          onClick={() => onTagSelect(tag.slug)}
          className={`px-4 py-2 rounded-xl text-[13px] font-medium 
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
  );
}
