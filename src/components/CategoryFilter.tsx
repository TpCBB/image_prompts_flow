'use client';

import { Language } from '@/types';
import { translations } from '@/lib/i18n';
import { isNsfwLabel } from '@/lib/content-visibility';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string | null;
  onCategorySelect: (category: string | null) => void;
  lang: Language;
}

export default function CategoryFilter({
  categories,
  selectedCategory,
  onCategorySelect,
  lang,
}: CategoryFilterProps) {
  const t = translations[lang];

  return (
    <div aria-label={t.category} className="flex flex-nowrap sm:flex-wrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-2 py-3 border-b border-white/20 dark:border-white/10">
      <button
        onClick={() => onCategorySelect(null)}
        aria-pressed={selectedCategory === null}
        className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-[13px] font-medium
                   backdrop-blur-md border
                   transition-all duration-200 active:scale-[0.97] ${
          selectedCategory === null
            ? 'bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 border-gray-900/50 dark:border-white/50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
            : 'bg-white/40 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-white/30 dark:border-white/10 hover:bg-white/60 dark:hover:bg-white/10'
        }`}
      >
        {t.allCategories}
      </button>
      {categories.filter((category) => !isNsfwLabel(category)).map((category) => (
        <button
          key={category}
          onClick={() => onCategorySelect(category)}
          aria-pressed={selectedCategory === category}
          className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-[13px] font-medium
                     backdrop-blur-md border
                     transition-all duration-200 active:scale-[0.97] ${
            selectedCategory === category
              ? 'bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 border-gray-900/50 dark:border-white/50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
              : 'bg-white/40 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-white/30 dark:border-white/10 hover:bg-white/60 dark:hover:bg-white/10'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
