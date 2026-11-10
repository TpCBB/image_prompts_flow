'use client';

import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Language } from '@/types';
import { translations } from '@/lib/i18n';

interface MobileSearchProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  lang: Language;
}

export default function MobileSearch({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  lang,
}: MobileSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure animation has started
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-x-0 top-0 z-[60] sm:hidden animate-mobile-search-in"
      role="dialog"
      aria-modal="true"
      aria-label={t.search}
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Search Panel */}
      <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl
                      border-b border-gray-200/50 dark:border-gray-800/50
                      shadow-lg">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" 
                strokeWidth={2} 
              />
              <input
                ref={inputRef}
                type="text"
                placeholder={t.search}
              maxLength={200}
              aria-label={t.search}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[15px]
                          bg-white/60 dark:bg-white/10 backdrop-blur-xl
                          border border-white/50 dark:border-white/20
                          placeholder:text-gray-400
                          shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]
                          focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 
                          focus:bg-white/80 dark:focus:bg-white/15
                          transition-all duration-200"
              />
              {/* Clear button when there's text */}
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 
                            w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600
                            flex items-center justify-center
                            hover:bg-gray-400 dark:hover:bg-gray-500
                            transition-colors"
                  aria-label={t.clearSearch}
                >
                  <X className="w-3 h-3 text-white" strokeWidth={2.5} />
                </button>
              )}
            </div>
            
            {/* Cancel Button */}
            <button
              onClick={onClose}
              className="text-[#007AFF] text-[15px] font-medium
                        hover:text-[#0056b3] active:opacity-70
                        transition-colors whitespace-nowrap"
            >
              {lang === 'zh' ? '取消' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
