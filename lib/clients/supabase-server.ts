/**
 * Server-side Supabase client with type safety
 * Use this for API routes and server components
 */

import type { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';

// Server-side client (uses anon key with RLS)
export function createServerSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

// Re-export for convenience
export const supabase = createServerSupabaseClient();

