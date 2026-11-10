'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { X, Copy, Check, Share2, ChevronDown } from 'lucide-react';
import { Prompt, Language } from '@/types';
import { translations } from '@/lib/i18n';
import { getImageUrl } from '@/lib/config';
import { useClipboard, useImageLoader } from '@/hooks';
import { isNsfwLabel } from '@/lib/content-visibility';

interface PromptModalProps {
  prompt: Prompt;
  lang: Language;
  onClose: () => void;
}

// 可配置的分享选项
const shareOptions = [
  {
    id: 'x',
    nameKey: 'shareToX' as const,
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    getUrl: (text: string, title: string) => 
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title}\n\n${text}`)}`
  },
];

export default function PromptModal({ prompt, lang, onClose }: PromptModalProps) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { imageSrc, imgRef, onLoad, onError } = useImageLoader({
    src: prompt.preview ? getImageUrl(prompt.preview) : null,
  });
  const t = translations[lang];

  // Use custom hook for clipboard operations
  const { copy, copied } = useClipboard({ resetDelay: 2000 });

  // 根据语言选择显示的标题和提示词（英文优先，没有则回退到中文）
  const displayTitle = lang === 'en' && prompt.title_en ? prompt.title_en : prompt.title;
  const displayPrompt = lang === 'en' && prompt.prompt_en ? prompt.prompt_en : prompt.prompt;

  // 按 ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  // 点击外部关闭分享菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShareMenu]);

  const handleCopy = async () => {
    await copy(displayPrompt);
  };

  const handleShareTo = (option: typeof shareOptions[0]) => {
    const url = option.getUrl(displayPrompt, displayTitle);
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowShareMenu(false);
  };

  const handleOpenGrok = async () => {
    await copy(displayPrompt);
    window.open('https://grok.com/', '_blank');
  };

  const handleOpenGemini = async () => {
    await copy(displayPrompt);
    window.open('https://gemini.google.com/app', '_blank');
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      {/* 背景遮罩 - 苹果风格动画 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xl modal-backdrop" />
      
      {/* 模态框 - 苹果风格动画 */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-4xl max-h-[90vh] 
                   bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl
                   rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]
                   overflow-hidden
                   flex flex-col sm:flex-row
                   border border-white/20 dark:border-white/10
                   modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 - 液态玻璃 */}
        <button
          onClick={onClose}
          aria-label={lang === 'zh' ? '关闭详情' : 'Close details'}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full
                    bg-white/20 dark:bg-black/30 backdrop-blur-xl
                    border border-white/30 dark:border-white/10
                    flex items-center justify-center
                    text-gray-700 dark:text-white
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]
                    hover:bg-white/40 dark:hover:bg-black/50
                    hover:scale-110
                    active:scale-95
                    transition-all duration-200"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>

        {/* 左侧图片 */}
        <div className="sm:w-1/2 bg-gray-100 dark:bg-gray-800 flex-shrink-0">
          <img
            ref={imgRef}
            src={imageSrc}
            onLoad={onLoad}
            onError={onError}
            alt={prompt.title}
            className="w-full h-full object-cover max-h-[40vh] sm:max-h-[90vh]"
          />
        </div>

        {/* 右侧内容 */}
        <div className="sm:w-1/2 flex flex-col overflow-hidden">
          {/* 头部 */}
          <div className="p-6 pb-4 border-b border-gray-100 dark:border-gray-800">
            <h2 id={titleId} className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {displayTitle}
            </h2>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-500 dark:text-gray-400">
                {t.author}: <span className="text-gray-700 dark:text-gray-300">{prompt.author}</span>
              </span>
              <div className="relative" ref={shareMenuRef}>
                <button
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="flex items-center gap-1.5 text-[13px] text-gray-500 
                            hover:text-gray-900 dark:hover:text-white transition-all duration-200
                            px-2.5 py-1.5 -mx-2.5 -my-1.5 rounded-lg
                            hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Share2 className="w-4 h-4" strokeWidth={2} />
                  <span className="hidden sm:inline">{t.share}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showShareMenu ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                </button>
                
                {/* 分享下拉菜单 - 苹果风格 */}
                {showShareMenu && (
                  <div className="absolute right-0 top-full mt-2 z-50
                                  bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl
                                  rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)]
                                  border border-gray-200/50 dark:border-white/10
                                  overflow-hidden
                                  min-w-[140px]
                                  animate-in">
                    {shareOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleShareTo(option)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5
                                  text-[13px] text-gray-700 dark:text-gray-200
                                  hover:bg-gray-100/80 dark:hover:bg-white/10
                                  transition-colors duration-150
                                  first:pt-3 last:pb-3"
                      >
                        <span className="text-gray-500 dark:text-gray-400">
                          {option.icon}
                        </span>
                        {t[option.nameKey]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 标签 - 过滤重复 */}
          <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-gray-100 dark:border-gray-800">
            {!isNsfwLabel(prompt.category) && <span className="px-3 py-1 rounded-full text-[12px] font-medium
                           bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {prompt.category}
            </span>}
            {prompt.sub_category && !isNsfwLabel(prompt.sub_category) && prompt.sub_category !== prompt.category && (
              <span className="px-3 py-1 rounded-full text-[12px] font-medium
                             bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {prompt.sub_category}
              </span>
            )}
            {Array.from(new Set(prompt.tags || []))
              .filter(tag => !isNsfwLabel(tag) && tag !== prompt.category && tag !== prompt.sub_category)
              .slice(0, 3)
              .map((tag, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-[12px] font-medium
                                         bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  {tag}
                </span>
              ))}
          </div>

          {/* Prompt 内容 */}
          <div className="flex-1 overflow-auto p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                PROMPT ({lang === 'zh' ? '中文' : 'EN'})
              </span>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 text-[12px] font-medium
                           transition-colors ${
                             copied 
                               ? 'text-green-600 dark:text-green-400' 
                               : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                           }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? t.copied : t.copyPrompt}
              </button>
            </div>
            <p className="text-[14px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {displayPrompt}
            </p>
          </div>

          {/* 底部按钮 - 液态玻璃风格 */}
          <div className="p-6 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
            {/* 复制按钮 */}
            <button
              onClick={handleCopy}
              className={`w-full h-12 rounded-2xl text-[14px] font-medium
                         backdrop-blur-xl border
                         transition-all duration-300 active:scale-[0.98]
                         ${copied
                           ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                           : 'bg-white/70 dark:bg-white/10 text-gray-800 dark:text-white border-white/50 dark:border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_20px_rgba(0,0,0,0.1)] hover:bg-white/90 dark:hover:bg-white/20'
                         }`}
            >
              {copied ? (
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                  {t.copied}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Copy className="w-4 h-4" strokeWidth={2} />
                  {t.copyPrompt}
                </span>
              )}
            </button>

            {/* Grok 和 Gemini 链接按钮 */}
            <div className="flex gap-3">
              {/* Grok - X/Twitter 风格: 黑白简约 */}
              <button
                onClick={handleOpenGrok}
                className="flex-1 h-11 rounded-2xl text-[13px] font-bold
                          transition-all duration-300 active:scale-[0.98]
                          bg-black dark:bg-white
                          hover:bg-gray-800 dark:hover:bg-gray-100
                          text-white dark:text-black
                          shadow-[0_2px_8px_rgba(0,0,0,0.2)]
                          hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]
                          flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                {t.openInGrok}
              </button>
              {/* Gemini - Google 风格: 彩色渐变 */}
              <button
                onClick={handleOpenGemini}
                className="flex-1 h-11 rounded-2xl text-[13px] font-medium
                          transition-all duration-300 active:scale-[0.98]
                          bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500
                          hover:from-blue-600 hover:via-purple-600 hover:to-pink-600
                          text-white
                          shadow-[0_2px_8px_rgba(139,92,246,0.3)]
                          hover:shadow-[0_4px_16px_rgba(139,92,246,0.4)]
                          flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C9.814 0 7.87 1.042 6.508 2.79c-.222.285-.203.69.045.949l4.983 5.207a.614.614 0 0 0 .928-.008l4.83-5.199c.245-.264.26-.664.037-.948C15.98 1.035 14.1 0 12 0zm.006 10.035a.608.608 0 0 0-.459.212L6.55 15.51c-.247.26-.264.66-.041.945C7.87 18.159 9.813 19.2 12 19.2c2.188 0 4.132-1.04 5.492-2.745.22-.284.203-.686-.044-.944l-4.983-5.263a.614.614 0 0 0-.459-.213zM5.262 4.058a.614.614 0 0 0-.458.212L.268 9.109a.642.642 0 0 0 .004.868l4.523 4.865c.247.265.664.26.904-.013 1.087-1.239 2.472-2.09 3.982-2.464a.637.637 0 0 0 .409-.913L6.185 4.27a.614.614 0 0 0-.462-.212h-.461zm13.015 0a.614.614 0 0 0-.459.212l-3.905 7.182a.637.637 0 0 0 .409.913c1.51.375 2.895 1.225 3.982 2.464.24.272.657.278.904.013l4.523-4.865a.642.642 0 0 0 .004-.868l-4.536-4.839a.614.614 0 0 0-.461-.212h-.461z"/>
                </svg>
                {t.openInGemini}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
