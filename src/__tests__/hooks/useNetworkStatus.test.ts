import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

/**
 * Feature: comprehensive-improvements, Property 3: Network Status Detection
 * Validates: Requirements 1.3
 * 
 * For any change in browser online/offline status, the useNetworkStatus hook
 * should return the correct isOnline/isOffline state.
 */

describe('useNetworkStatus', () => {
  let originalNavigator: Navigator;
  let mockOnLine: boolean;

  beforeEach(() => {
    originalNavigator = global.navigator;
    mockOnLine = true;
    
    // Mock navigator.onLine
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        get onLine() {
          return mockOnLine;
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('Property 3: Network Status Detection', () => {
    it('should return correct initial state based on navigator.onLine', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (initialOnlineState) => {
            mockOnLine = initialOnlineState;
            
            const { result } = renderHook(() => useNetworkStatus());
            
            // After hydration, should reflect actual navigator.onLine
            expect(result.current.isOnline).toBe(initialOnlineState);
            expect(result.current.isOffline).toBe(!initialOnlineState);
            expect(result.current.isHydrated).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should update state when online event is fired', () => {
      fc.assert(
        fc.property(
          fc.constant(false), // Start offline
          () => {
            mockOnLine = false;
            
            const { result } = renderHook(() => useNetworkStatus());
            
            expect(result.current.isOnline).toBe(false);
            expect(result.current.isOffline).toBe(true);
            expect(result.current.isHydrated).toBe(true);
            
            // Simulate going online
            act(() => {
              mockOnLine = true;
              window.dispatchEvent(new Event('online'));
            });
            
            expect(result.current.isOnline).toBe(true);
            expect(result.current.isOffline).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should update state when offline event is fired', () => {
      fc.assert(
        fc.property(
          fc.constant(true), // Start online
          () => {
            mockOnLine = true;
            
            const { result } = renderHook(() => useNetworkStatus());
            
            expect(result.current.isOnline).toBe(true);
            expect(result.current.isOffline).toBe(false);
            expect(result.current.isHydrated).toBe(true);
            
            // Simulate going offline
            act(() => {
              mockOnLine = false;
              window.dispatchEvent(new Event('offline'));
            });
            
            expect(result.current.isOnline).toBe(false);
            expect(result.current.isOffline).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain isOnline and isOffline as logical inverses', () => {
      fc.assert(
        fc.property(
          fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
          (stateSequence) => {
            mockOnLine = stateSequence[0];
            
            const { result } = renderHook(() => useNetworkStatus());
            
            // Verify invariant: isOnline and isOffline are always logical inverses
            expect(result.current.isOnline).toBe(!result.current.isOffline);
            
            // Apply state changes and verify invariant holds
            for (const newState of stateSequence) {
              act(() => {
                mockOnLine = newState;
                window.dispatchEvent(new Event(newState ? 'online' : 'offline'));
              });
              
              expect(result.current.isOnline).toBe(!result.current.isOffline);
              expect(result.current.isOnline).toBe(newState);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should set isHydrated to true after mount', () => {
      mockOnLine = true;
      const { result } = renderHook(() => useNetworkStatus());
      
      // After useEffect runs, isHydrated should be true
      expect(result.current.isHydrated).toBe(true);
    });
  });
});
