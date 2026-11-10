"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, FileText } from "lucide-react";
import { Prompt, Language } from "@/types";
import { translations } from "@/lib/i18n";
import { getImageUrl } from "@/lib/config";
import { useImageLoader, useClipboard } from "@/hooks";
import { isNsfwLabel } from "@/lib/content-visibility";

interface PromptCardProps {
  prompt: Prompt;
  lang: Language;
  onClick?: () => void;
}

const FALLBACK_IMAGE = "/placeholder.svg";

export default function PromptCard({ prompt, lang, onClick }: PromptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const t = translations[lang];

  // Use custom hooks for image loading and clipboard
  const originalSrc = prompt.preview ? getImageUrl(prompt.preview) : null;
  const thumbnailSrc = prompt.preview_variants?.[0] ? getImageUrl(prompt.preview_variants[0].path) : originalSrc;
  const { imageSrc, isLoaded, imgRef, onLoad, onError } = useImageLoader({
    src: thumbnailSrc,
    fallbackSrc: FALLBACK_IMAGE,
    fallbackSources: originalSrc && thumbnailSrc !== originalSrc ? [originalSrc, FALLBACK_IMAGE] : [FALLBACK_IMAGE],
  });

  const { copy, copied } = useClipboard({ resetDelay: 2000 });

  // 根据语言选择显示的标题和提示词（英文优先，没有则回退到中文）
  const displayTitle = lang === 'en' && prompt.title_en ? prompt.title_en : prompt.title;
  const displayPrompt = lang === 'en' && prompt.prompt_en ? prompt.prompt_en : prompt.prompt;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copy(displayPrompt);
  };

  const truncatedPrompt =
    displayPrompt.length > 100
      ? displayPrompt.slice(0, 100) + "..."
      : displayPrompt;

  return (
    <div
      className="group bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl overflow-hidden 
                 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)]
                 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] 
                 dark:shadow-[0_2px_15px_-3px_rgba(0,0,0,0.3)]
                 transition-shadow duration-300 ease-out
                 border border-gray-200/50 dark:border-gray-700/50
                 break-inside-avoid mb-5 cursor-pointer
                 will-change-[opacity,transform]"
      onClick={onClick}
    >
      {/* Preview Image - 使用固定 aspect-ratio 减少布局抖动 */}
      <div className="relative overflow-hidden bg-gray-100 dark:bg-gray-800">
        {/* 图片容器 - 使用最小高度和自适应 */}
        <div className="min-h-[160px]" style={{ aspectRatio: `${prompt.preview_width || 4} / ${prompt.preview_height || 3}` }}>
          {prompt.preview ? (
            <img
              ref={imgRef}
              src={imageSrc}
              srcSet={imageSrc === thumbnailSrc && prompt.preview_variants ? prompt.preview_variants.map((variant) => `${getImageUrl(variant.path)} ${variant.width}w`).join(', ') : undefined}
              sizes="(min-width: 1280px) 288px, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 92vw"
              width={prompt.preview_width || 4}
              height={prompt.preview_height || 3}
              alt={prompt.title}
              className={`w-full h-full object-cover
                         transition-opacity duration-200 ease-out
                         ${isLoaded ? "opacity-100" : "opacity-0"}`}
              loading="lazy"
              decoding="async"
              onLoad={onLoad}
              onError={onError}
            />
          ) : (
            <div className="h-40 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 
                           flex items-center justify-center">
              <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600" />
            </div>
          )}
        </div>
        {/* 骨架屏 - 绝对定位覆盖，添加淡出动画（仅有图片时显示） */}
        {prompt.preview && (
          <div 
            className={`absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800
                       transition-opacity duration-200 ease-out
                       ${isLoaded ? "opacity-0 pointer-events-none" : "opacity-100 animate-pulse"}`}
          />
        )}
        {/* Category Badge - Apple 风格毛玻璃 */}
        {!isNsfwLabel(prompt.category) && <div className="absolute top-3 right-3">
          <span
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide
                          bg-white/70 dark:bg-black/50 backdrop-blur-md
                          text-gray-800 dark:text-gray-200
                          border border-white/20 shadow-sm"
          >
            {prompt.category}
          </span>
        </div>}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3
          className="font-semibold text-[15px] text-gray-900 dark:text-white mb-2 
                       leading-snug tracking-tight line-clamp-2"
        >
          {displayTitle}
        </h3>

        <p
          className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed cursor-pointer
                     hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? displayPrompt : truncatedPrompt}
        </p>

        {/* Author */}
        <div className="flex items-center mt-3 mb-4">
          <span className="text-[12px] text-gray-400 dark:text-gray-500 font-medium">
            {prompt.author}
          </span>
        </div>

        {/* Actions - Apple 液态玻璃风格按钮 */}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className={`glass-button flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl
                       text-[13px] font-medium tracking-wide
                       backdrop-blur-xl border
                       transition-all duration-300 ease-out
                       active:scale-[0.97]
                       hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_24px_rgba(0,0,0,0.12)]
                       hover:-translate-y-0.5
                       ${copied
                         ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                         : 'bg-white/60 dark:bg-white/10 text-gray-800 dark:text-white border-white/40 dark:border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_16px_rgba(0,0,0,0.08)]'
                       }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" strokeWidth={2.5} />
                <span>{t.copied}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" strokeWidth={2} />
                <span>{t.copyPrompt}</span>
              </>
            )}
          </button>

          {prompt.link && (
            <a
              href={prompt.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="glass-button flex items-center justify-center w-11 h-11 rounded-2xl
                        bg-white/60 dark:bg-white/10 backdrop-blur-xl
                        border border-white/40 dark:border-white/20
                        text-gray-600 dark:text-gray-300
                        shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_16px_rgba(0,0,0,0.08)]
                        hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_24px_rgba(0,0,0,0.12)]
                        hover:-translate-y-0.5 hover:text-gray-900 dark:hover:text-white
                        active:scale-[0.95]
                        transition-all duration-200"
              title={t.viewSource}
            >
              <ExternalLink className="w-4 h-4" strokeWidth={2} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
