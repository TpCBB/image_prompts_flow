import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { mapDbPromptToPrompt, safeString, safeArray } from '@/lib/type-mapping';
import { DbPrompt, Prompt } from '@/types';

/**
 * Feature: comprehensive-improvements, Property 8: Null Safety for Optional Fields
 * Validates: Requirements 3.5
 * 
 * For any Prompt object with null/undefined optional fields, accessing those fields
 * should not throw an error and should return appropriate fallback values.
 */

// Generator for DbPrompt with many null optional fields
const dbPromptWithNullsArbitrary = fc.record({
  id: fc.integer({ min: 1 }),
  title: fc.string({ minLength: 1 }),
  title_en: fc.constant(null),
  preview: fc.constant(null),
  prompt: fc.string({ minLength: 1 }),
  prompt_en: fc.constant(null),
  description: fc.constant(null),
  description_en: fc.constant(null),
  author: fc.string({ minLength: 1 }),
  link: fc.constant(null),
  mode: fc.oneof(fc.constant('generate'), fc.constant('edit')),
  category: fc.string({ minLength: 1 }),
  sub_category: fc.constant(null),
  created_at: fc.constant(null),
  tags: fc.constant(null),
  prompt_type: fc.constant(null),
  use_cases: fc.constant(null),
});

// Generator for DbPrompt with mixed null/undefined/value fields
const dbPromptMixedArbitrary = fc.record({
  id: fc.integer({ min: 1 }),
  title: fc.string({ minLength: 1 }),
  title_en: fc.oneof(fc.constant(null), fc.constant(undefined), fc.string()),
  preview: fc.oneof(fc.constant(null), fc.constant(undefined), fc.string()),
  prompt: fc.string({ minLength: 1 }),
  prompt_en: fc.oneof(fc.constant(null), fc.constant(undefined), fc.string()),
  description: fc.oneof(fc.constant(null), fc.constant(undefined), fc.string()),
  description_en: fc.oneof(fc.constant(null), fc.constant(undefined), fc.string()),
  author: fc.string({ minLength: 1 }),
  link: fc.oneof(fc.constant(null), fc.constant(undefined), fc.string()),
  mode: fc.oneof(fc.constant('generate'), fc.constant('edit')),
  category: fc.string({ minLength: 1 }),
  sub_category: fc.oneof(fc.constant(null), fc.constant(undefined), fc.string()),
  created_at: fc.oneof(
    fc.constant(null), 
    fc.constant(undefined), 
    fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }).map(d => d.toISOString())
  ),
  tags: fc.oneof(fc.constant(null), fc.constant(undefined), fc.array(fc.string())),
  prompt_type: fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant('image'), fc.constant('functional')),
  use_cases: fc.oneof(fc.constant(null), fc.constant(undefined), fc.array(fc.string())),
});

describe('Null Safety for Optional Fields', () => {
  it('should not throw when accessing optional fields on Prompt with all nulls', () => {
    fc.assert(
      fc.property(dbPromptWithNullsArbitrary, (dbPrompt: DbPrompt) => {
        const prompt = mapDbPromptToPrompt(dbPrompt);
        
        // Accessing all optional fields should not throw
        expect(() => {
          const _ = {
            titleEn: prompt.title_en,
            preview: prompt.preview,
            promptEn: prompt.prompt_en,
            description: prompt.description,
            descriptionEn: prompt.description_en,
            link: prompt.link,
            subCategory: prompt.sub_category,
            tags: prompt.tags,
            useCases: prompt.use_cases,
          };
        }).not.toThrow();
      }),
      { numRuns: 20 }
    );
  });

  it('should handle mixed null/undefined/value fields without throwing', () => {
    fc.assert(
      fc.property(dbPromptMixedArbitrary, (dbPrompt) => {
        const prompt = mapDbPromptToPrompt(dbPrompt as DbPrompt);
        
        // All optional fields should be either null or a valid value (not undefined)
        const optionalStringFields: (keyof Prompt)[] = [
          'title_en', 'preview', 'prompt_en', 'description', 
          'description_en', 'link', 'sub_category'
        ];
        
        for (const field of optionalStringFields) {
          const value = prompt[field];
          // Should be null or a string, never undefined
          expect(value === null || typeof value === 'string').toBe(true);
        }
        
        // Array fields
        expect(prompt.tags === null || Array.isArray(prompt.tags)).toBe(true);
        expect(prompt.use_cases === null || Array.isArray(prompt.use_cases)).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  it('safeString should return fallback for null/undefined', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.constant(undefined)),
        fc.string(),
        (nullish, fallback) => {
          const result = safeString(nullish, fallback);
          expect(result).toBe(fallback);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('safeString should return value when not null/undefined', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (value, fallback) => {
        const result = safeString(value, fallback);
        expect(result).toBe(value);
      }),
      { numRuns: 20 }
    );
  });

  it('safeArray should return fallback for null/undefined', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.constant(undefined)),
        fc.array(fc.string()),
        (nullish, fallback) => {
          const result = safeArray(nullish, fallback);
          expect(result).toEqual(fallback);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('safeArray should return value when not null/undefined', () => {
    fc.assert(
      fc.property(fc.array(fc.string()), fc.array(fc.string()), (value, fallback) => {
        const result = safeArray(value, fallback);
        expect(result).toEqual(value);
      }),
      { numRuns: 20 }
    );
  });
});
