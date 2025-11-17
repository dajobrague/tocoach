/**
 * Database type definitions for Supabase
 * These types should be generated from your database schema
 * For now, we'll use a simplified version
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            tenants: {
                Row: {
                    host: string
                    slug: string
                    theme_slug: string
                    theme_version: string | null
                    theme_json: Json
                    tables: Json
                    stripe_customer_portal_conf: Json | null
                    features: Json
                    status: 'active' | 'inactive'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    host: string
                    slug: string
                    theme_slug: string
                    theme_version?: string | null
                    theme_json: Json
                    tables?: Json
                    stripe_customer_portal_conf?: Json | null
                    features?: Json
                    status?: 'active' | 'inactive'
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    host?: string
                    slug?: string
                    theme_slug?: string
                    theme_version?: string | null
                    theme_json?: Json
                    tables?: Json
                    stripe_customer_portal_conf?: Json | null
                    features?: Json
                    status?: 'active' | 'inactive'
                    created_at?: string
                    updated_at?: string
                }
            }
            trainer_profiles: {
                Row: {
                    id: string
                    email: string
                    full_name: string
                    business_name: string | null
                    tenant_host: string | null
                    status: string
                    subscription_tier: string
                    created_at: string
                    updated_at: string
                    last_login_at: string | null
                }
                Insert: {
                    id: string
                    email: string
                    full_name: string
                    business_name?: string | null
                    tenant_host?: string | null
                    status?: string
                    subscription_tier?: string
                    created_at?: string
                    updated_at?: string
                    last_login_at?: string | null
                }
                Update: {
                    id?: string
                    email?: string
                    full_name?: string
                    business_name?: string | null
                    tenant_host?: string | null
                    status?: string
                    subscription_tier?: string
                    created_at?: string
                    updated_at?: string
                    last_login_at?: string | null
                }
            }
            client_profiles: {
                Row: {
                    id: string
                    tenant_host: string
                    email: string
                    full_name: string
                    phone: string | null
                    status: string
                    onboarding_completed: boolean
                    profile_image_url: string | null
                    timezone: string
                    date_of_birth: string | null
                    emergency_contact: Json | null
                    notes: string | null
                    metadata: Json
                    created_at: string
                    updated_at: string
                    last_login_at: string | null
                }
                Insert: {
                    id: string
                    tenant_host: string
                    email: string
                    full_name: string
                    phone?: string | null
                    status?: string
                    onboarding_completed?: boolean
                    profile_image_url?: string | null
                    timezone?: string
                    date_of_birth?: string | null
                    emergency_contact?: Json | null
                    notes?: string | null
                    metadata?: Json
                    created_at?: string
                    updated_at?: string
                    last_login_at?: string | null
                }
                Update: {
                    id?: string
                    tenant_host?: string
                    email?: string
                    full_name?: string
                    phone?: string | null
                    status?: string
                    onboarding_completed?: boolean
                    profile_image_url?: string | null
                    timezone?: string
                    date_of_birth?: string | null
                    emergency_contact?: Json | null
                    notes?: string | null
                    metadata?: Json
                    created_at?: string
                    updated_at?: string
                    last_login_at?: string | null
                }
            }
            // Add other tables as needed
            [key: string]: {
                Row: Record<string, any>
                Insert: Record<string, any>
                Update: Record<string, any>
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            tenant_status: 'active' | 'inactive'
        }
    }
}

