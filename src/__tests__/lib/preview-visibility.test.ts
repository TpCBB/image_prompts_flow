// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getHiddenDuplicateIds } from '@/lib/preview-visibility';
import { IMAGE_BASE_URL } from '@/lib/config';

describe('Duplicate preview visibility', () => {
  it('keeps exactly one stable representative regardless of row order', () => {
    const rows = Array.from({ length: 55 }, (_, i) => ({
      id: i + 1, preview: 'shared.jpg', prompt_type: 'image',
    }));
    const hidden = getHiddenDuplicateIds(rows);
    expect(hidden).toHaveLength(54);
    expect(getHiddenDuplicateIds([...rows].reverse())).toEqual(hidden);
    expect(rows.filter((row) => !hidden.includes(row.id))).toHaveLength(1);
  });

  it('groups relative paths and their full CDN URLs together', () => {
    expect(getHiddenDuplicateIds([
      { id: 1, preview: 'shared.jpg', prompt_type: 'image' },
      { id: 2, preview: `${IMAGE_BASE_URL}/shared.jpg`, prompt_type: 'image' },
      { id: 3, preview: 'unique.jpg', prompt_type: 'image' },
    ])).toHaveLength(1);
  });

  it('preserves prompts without images and functional prompts', () => {
    expect(getHiddenDuplicateIds([
      { id: 1, preview: null, prompt_type: 'image' },
      { id: 2, preview: '', prompt_type: 'image' },
      { id: 3, preview: 'shared.jpg', prompt_type: 'functional' },
      { id: 4, preview: 'shared.jpg', prompt_type: 'functional' },
      { id: 5, preview: 'shared.jpg', prompt_type: 'image' },
    ])).toEqual([]);
  });
});
