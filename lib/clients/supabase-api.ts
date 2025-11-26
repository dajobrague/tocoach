/**
 * Supabase client factory for API routes
 * Creates client lazily to avoid build-time initialization
 */
import { createClient } from "@supabase/supabase-js";

/**
 * Create a Supabase client for API routes (with anon key)
 * This should be called inside route handlers, not at module level
 *
 * Note: Trainers use custom JWT sessions (not Supabase auth sessions)
 * Authentication is verified at the API route level via getTrainerSession()
 * RLS policies allow anon access to training tables
 */
export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseKey);
}
