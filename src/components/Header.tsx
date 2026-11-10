'use client';

import { useState } from 'react';
import { Search, Globe, Sparkles } from 'lucide-react';
import { Language, PromptType } from '@/types';
import { translations } from '@/lib/i18n';
import MobileSearch from './MobileSearch';

interface HeaderProps {
  lang: Language;
  onLangChange: (lang: Language) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  promptType: PromptType;
  onPromptTypeChange: (type: PromptType) => void;
  isHidden?: boolean;
}

export default function Header({
  lang,
  onLangChange,
  searchQuery,
  onSearchChange,
  promptType,
  onPromptTypeChange,
  isHidden = false,
}: HeaderProps) {
  const t = translations[lang];
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  return (
    <>
      <header 
        className={`sticky top-0 z-50 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl 
                   border-b border-gray-200/50 dark:border-gray-800/50
                   supports-[backdrop-filter]:bg-white/60
                   transition-transform duration-300
                   ${isHidden ? '-translate-y-full' : 'translate-y-0'}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo - Apple 风格 */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#007AFF] rounded-xl flex items-center justify-center
                             shadow-[0_2px_8px_rgba(0,122,255,0.3)]">
                <Sparkles className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-[17px] text-gray-900 dark:text-white tracking-tight hidden sm:inline">
                {t.siteName}
              </span>
            </div>

            {/* Prompt Type Tab - 液态玻璃风格 */}
            <div className="flex items-center gap-1 p-1 rounded-xl 
                           bg-white/60 dark:bg-white/10 backdrop-blur-xl 
                           border border-white/50 dark:border-white/20
                           shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              <button
                onClick={() => onPromptTypeChange('image')}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200
                           ${promptType === 'image'
                             ? 'bg-[#007AFF] text-white shadow-md'
                             : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10'
                           }`}
              >
                {t.imagePrompt}
              </button>
              <button
                onClick={() => onPromptTypeChange('functional')}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200
                           ${promptType === 'functional'
                             ? 'bg-[#007AFF] text-white shadow-md'
                             : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10'
                           }`}
              >
                {t.functionalPrompt}
              </button>
            </div>

            {/* Search Bar - Desktop only (液态玻璃风格) */}
            <div className="flex-1 max-w-md mx-6 hidden sm:block">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
                <input
                  type="text"
                  placeholder={t.search}
                  maxLength={200}
                  aria-label={t.search}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[14px]
                            bg-white/60 dark:bg-white/10 backdrop-blur-xl
                            border border-white/50 dark:border-white/20
                            placeholder:text-gray-400
                            shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]
                            focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/80 dark:focus:bg-white/15
                            transition-all duration-200"
                />
              </div>
            </div>

            {/* Right side buttons */}
            <div className="flex items-center gap-2">
              {/* Mobile Search Button - Only visible on mobile */}
              <button
                onClick={() => setIsMobileSearchOpen(true)}
                className="sm:hidden flex items-center justify-center w-9 h-9 rounded-xl
                          bg-white/60 dark:bg-white/10 backdrop-blur-xl
                          border border-white/50 dark:border-white/20
                          shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]
                          hover:bg-white/80 dark:hover:bg-white/20
                          active:scale-[0.97]
                          transition-all duration-200"
                aria-label={t.search}
              >
                <Search className="w-4 h-4 text-gray-700 dark:text-gray-200" strokeWidth={2} />
              </button>

              {/* Language Toggle - 液态玻璃风格 */}
              <button
                onClick={() => onLangChange(lang === 'zh' ? 'en' : 'zh')}
                aria-label={lang === 'zh' ? '切换为英文' : 'Switch to Chinese'}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl
                          text-[13px] font-medium text-gray-700 dark:text-gray-200
                          bg-white/60 dark:bg-white/10 backdrop-blur-xl
                          border border-white/50 dark:border-white/20
                          shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]
                          hover:bg-white/80 dark:hover:bg-white/20
                          active:scale-[0.97]
                          transition-all duration-200"
              >
                <Globe className="w-4 h-4" strokeWidth={2} />
                <span className="hidden xs:inline">{lang === 'zh' ? 'EN' : '中文'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search Panel */}
      <MobileSearch
        isOpen={isMobileSearchOpen}
        onClose={() => setIsMobileSearchOpen(false)}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        lang={lang}
      />
    </>
  );
}
