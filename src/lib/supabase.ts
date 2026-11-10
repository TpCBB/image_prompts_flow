import 'server-only';
import { getSupabaseAdmin } from './supabase-server';

// Browsers use our protected API; anonymous database access can be revoked.
export const supabase = getSupabaseAdmin();

// Re-export types from central types module for backward compatibility
export type { DbPrompt, Tag as DbTag } from '@/types';
