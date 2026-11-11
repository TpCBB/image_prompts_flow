import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerDatabaseConfig } from './database-config';

let adminClient: SupabaseClient | undefined;

// Only server components and API handlers may import this client. Management
// endpoints authorize ADMIN_API_TOKEN before executing any write.
export function getSupabaseAdmin() {
  if (!adminClient) {
    const { url, key } = getServerDatabaseConfig(process.env);
    adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}
