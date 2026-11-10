import { createHash } from 'node:crypto';
import { IMAGE_CANONICAL_BASE_URL } from './config';

interface PreviewRecord {
  id: number;
  preview: string | null;
  prompt_type: string;
}

// A deterministic random ranking keeps the same representative across SSR,
// searches, pages and server instances without changing the stored prompts.
export function getHiddenDuplicateIds(rows: PreviewRecord[]): number[] {
  const representatives = new Map<string, { id: number; rank: string }>();
  const hidden: number[] = [];

  for (const row of rows) {
    if (row.prompt_type !== 'image' || !row.preview) continue;
    // Selection must not change when a local test or a deployment uses a
    // different asset host. This matches the database gallery view.
    const imageUrl = /^https?:\/\//.test(row.preview) ? row.preview : `${IMAGE_CANONICAL_BASE_URL}/${row.preview}`;
    const rank = createHash('sha256')
      .update(`preview-selection-v1\0${imageUrl}\0${row.id}`).digest('hex');
    const previous = representatives.get(imageUrl);
    if (!previous) {
      representatives.set(imageUrl, { id: row.id, rank });
    } else if (rank < previous.rank || (rank === previous.rank && row.id < previous.id)) {
      hidden.push(previous.id);
      representatives.set(imageUrl, { id: row.id, rank });
    } else {
      hidden.push(row.id);
    }
  }

  return hidden.sort((a, b) => a - b);
}
