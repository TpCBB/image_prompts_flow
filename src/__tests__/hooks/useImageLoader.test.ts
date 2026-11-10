import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import { useImageLoader } from '@/hooks/useImageLoader';

/**
 * Feature: comprehensive-improvements, Property 9: Image Loader State Management
 * Validates: Requirements 4.2
 * 
 * For any image source provided to useImageLoader, the hook should correctly
 * transition through loading states (not loaded → loaded or error).
 */

// Mock Image constructor
class MockImage {
  src: string = '';
  complete: boolean = false;
  naturalWidth: number = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

describe('useImageLoader', () => {
  it('falls back from a missing thumbnail to the original, then the placeholder', () => {
    const { result } = renderHook(() => useImageLoader({
      src: '/thumbnail.webp', fallbackSources: ['/original.png', '/placeholder.svg'],
    }));
    act(() => result.current.onError());
    expect(result.current.imageSrc).toBe('/original.png');
    act(() => result.current.onError());
    expect(result.current.imageSrc).toBe('/placeholder.svg');
    act(() => result.current.onLoad());
    expect(result.current.isLoaded).toBe(true);
  });
  let originalImage: typeof Image;

  beforeEach(() => {
    originalImage = global.Image;
    // @ts-expect-error - mocking Image constructor
    global.Image = MockImage;
  });

  afterEach(() => {
    global.Image = originalImage;
  });

  describe('Property 9: Image Loader State Management', () => {
    it('should start in loading state for valid image sources', () => {
      // Generate valid URL-like strings
      const testCases = fc.sample(
        fc.webUrl(),
        100
      );
      
      for (const src of testCases) {
        const { result, unmount } = renderHook(() => useImageLoader({ src }));
        
        // Should start in loading state (not loaded, not error)
        expect(result.current.isLoading).toBe(true);
        expect(result.current.isLoaded).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(result.current.imageSrc).toBe(src);
        
        unmount();
      }
    });

    it('should transition to loaded state when onLoad is called', () => {
      const testCases = fc.sample(fc.webUrl(), 100);
      
      for (const src of testCases) {
        const { result, unmount } = renderHook(() => useImageLoader({ src }));
        
        // Initially loading
        expect(result.current.isLoading).toBe(true);
        
        // Simulate successful load
        act(() => {
          result.current.onLoad();
        });
        
        // Should be loaded
        expect(result.current.isLoaded).toBe(true);
        expect(result.current.isError).toBe(false);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.imageSrc).toBe(src);
        
        unmount();
      }
    });

    it('should transition to error state and use fallback when onError is called', () => {
      const testCases = fc.sample(
        fc.record({
          src: fc.webUrl(),
          fallbackSrc: fc.webUrl(),
        }),
        100
      );
      
      for (const { src, fallbackSrc } of testCases) {
        const { result, unmount } = renderHook(() => 
          useImageLoader({ src, fallbackSrc })
        );
        
        // Initially loading
        expect(result.current.isLoading).toBe(true);
        
        // Simulate error
        act(() => {
          result.current.onError();
        });
        
        // Should be in error state with fallback
        expect(result.current.isError).toBe(true);
        expect(result.current.isLoaded).toBe(false);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.imageSrc).toBe(fallbackSrc);
        
        unmount();
      }
    });

    it('should use default fallback when no fallbackSrc provided', () => {
      const testCases = fc.sample(fc.webUrl(), 100);
      
      for (const src of testCases) {
        const { result, unmount } = renderHook(() => useImageLoader({ src }));
        
        // Simulate error
        act(() => {
          result.current.onError();
        });
        
        // Should use default fallback
        expect(result.current.imageSrc).toBe('/placeholder.svg');
        
        unmount();
      }
    });

    it('should handle null/undefined src by using fallback immediately', () => {
      const nullCases = [null, undefined];
      
      for (const src of nullCases) {
        const fallbackSrc = 'https://example.com/fallback.jpg';
        const { result, unmount } = renderHook(() => 
          useImageLoader({ src, fallbackSrc })
        );
        
        // Should immediately use fallback and be loaded
        expect(result.current.imageSrc).toBe(fallbackSrc);
        expect(result.current.isLoaded).toBe(true);
        expect(result.current.isError).toBe(false);
        expect(result.current.isLoading).toBe(false);
        
        unmount();
      }
    });

    it('should maintain state invariants: exactly one of isLoading, isLoaded, isError is true', () => {
      const testCases = fc.sample(fc.webUrl(), 100);
      
      for (const src of testCases) {
        const { result, unmount } = renderHook(() => useImageLoader({ src }));
        
        // Check invariant in initial state
        const initialStates = [
          result.current.isLoading,
          result.current.isLoaded,
          result.current.isError,
        ];
        // isLoading should be true, others false (or isLoaded true if cached)
        expect(initialStates.filter(Boolean).length).toBeLessThanOrEqual(1);
        
        // After load
        act(() => {
          result.current.onLoad();
        });
        
        const loadedStates = [
          result.current.isLoading,
          result.current.isLoaded,
          result.current.isError,
        ];
        expect(loadedStates.filter(Boolean).length).toBe(1);
        expect(result.current.isLoaded).toBe(true);
        
        unmount();
      }
    });

    it('should reset states when src changes', () => {
      const testCases = fc.sample(
        fc.record({
          src1: fc.webUrl(),
          src2: fc.webUrl(),
        }),
        100
      );
      
      for (const { src1, src2 } of testCases) {
        const { result, rerender, unmount } = renderHook(
          ({ src }) => useImageLoader({ src }),
          { initialProps: { src: src1 } }
        );
        
        // Load first image
        act(() => {
          result.current.onLoad();
        });
        
        expect(result.current.isLoaded).toBe(true);
        
        // Change src
        rerender({ src: src2 });
        
        // Should reset to loading state
        expect(result.current.isLoading).toBe(true);
        expect(result.current.isLoaded).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(result.current.imageSrc).toBe(src2);
        
        unmount();
      }
    });
  });
});
