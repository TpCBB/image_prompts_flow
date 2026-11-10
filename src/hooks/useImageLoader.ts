'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseImageLoaderOptions {
  /** Image source URL */
  src: string | null | undefined;
  /** Fallback image source when main image fails to load */
  fallbackSrc?: string;
  /** Ordered fallbacks, e.g. thumbnail -> original -> placeholder. */
  fallbackSources?: string[];
}

export interface UseImageLoaderReturn {
  /** Current image source to display */
  imageSrc: string;
  /** Whether the image has loaded successfully */
  isLoaded: boolean;
  /** Whether the image failed to load */
  isError: boolean;
  /** Whether the image is currently loading */
  isLoading: boolean;
  /** Ref to attach to the img element */
  imgRef: React.RefObject<HTMLImageElement>;
  /** Handler for image load event */
  onLoad: () => void;
  /** Handler for image error event */
  onError: () => void;
}

const DEFAULT_FALLBACK = '/placeholder.svg';

/**
 * Hook for managing image loading states
 * Handles loading, loaded, and error states with fallback support
 */
export function useImageLoader(options: UseImageLoaderOptions): UseImageLoaderReturn {
  const { src, fallbackSrc = DEFAULT_FALLBACK, fallbackSources } = options;
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [fallbackIndex, setFallbackIndex] = useState(-1);
  const imgRef = useRef<HTMLImageElement>(null);

  // Determine the current image source
  const fallbacks = fallbackSources?.length ? fallbackSources : [fallbackSrc];
  const imageSrc = !src ? fallbackSrc : fallbackIndex < 0 ? src : fallbacks[Math.min(fallbackIndex, fallbacks.length - 1)];
  
  // Check if image is already cached on mount
  useEffect(() => {
    if (!src) {
      setFallbackIndex(0);
      setIsLoaded(true);
      return;
    }

    // Reset states when src changes
    setIsLoaded(false);
    setIsError(false);
    setFallbackIndex(-1);

    // Check if image is already in browser cache
    // Inspect the rendered element: a separate Image() eagerly downloads every
    // preview and defeats loading="lazy" on the card.
    const img = imgRef.current;
    
    if (img?.complete && img.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [src]);

  const onLoad = useCallback(() => {
    setIsLoaded(true);
    setIsError(false);
  }, []);

  const onError = useCallback(() => {
    setIsError(true);
    setIsLoaded(false);
    setFallbackIndex((index) => Math.min(index + 1, fallbacks.length - 1));
  }, [fallbacks.length]);

  return {
    imageSrc,
    isLoaded,
    isError,
    isLoading: !isLoaded && !isError,
    imgRef,
    onLoad,
    onError,
  };
}
