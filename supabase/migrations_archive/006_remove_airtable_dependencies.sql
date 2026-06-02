-- Remove Airtable-specific columns from tenants table
-- This migration removes all Airtable dependencies as we move to 100% Supabase
-- Drop Airtable-specific columns
ALTER TABLE tenants DROP COLUMN IF EXISTS airtable_api_key_enc,
    DROP COLUMN IF EXISTS airtable_base_id;
-- Update comments to reflect new architecture
COMMENT ON TABLE tenants IS 'Multi-tenant configuration store for domain and theme management';
COMMENT ON COLUMN tenants.tables IS 'Internal table configuration and feature mappings (JSON)';
-- The 'tables' column is repurposed for internal Supabase table configuration
-- Example structure: {"features": {"clients_enabled": true, "billing_enabled": false}}