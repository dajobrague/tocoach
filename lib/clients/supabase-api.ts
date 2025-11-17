/**
 * Supabase client factory for API routes
 * Creates client lazily to avoid build-time initialization
 */
import { createClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client for API routes
 * This should be called inside route handlers, not at module level
 */
export function createSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseKey);
}

