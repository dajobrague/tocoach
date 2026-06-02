-- Create tenant_status enum
CREATE TYPE tenant_status AS ENUM ('active', 'inactive');

-- Create tenants table for multi-tenant domain resolution
CREATE TABLE IF NOT EXISTS tenants (
    host TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    theme_slug TEXT NOT NULL,
    theme_version TEXT,
    theme_json JSONB NOT NULL DEFAULT '{}',
    airtable_api_key_enc TEXT, -- AES-GCM encrypted
    airtable_base_id TEXT,
    tables JSONB NOT NULL DEFAULT '{}',
    stripe_customer_portal_conf JSONB,
    features JSONB NOT NULL DEFAULT '{}',
    status tenant_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Check constraints
    CONSTRAINT host_not_empty CHECK (host != ''),
    CONSTRAINT slug_not_empty CHECK (slug != ''),
    CONSTRAINT theme_slug_not_empty CHECK (theme_slug != ''),
    CONSTRAINT theme_json_required_keys CHECK (
        theme_json ? 'meta' AND 
        theme_json ? 'fonts' AND 
        theme_json ? 'colors' AND 
        theme_json ? 'radius' AND 
        theme_json ? 'shadow'
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS tenants_status_idx ON tenants(status);
CREATE INDEX IF NOT EXISTS tenants_features_gin ON tenants USING GIN (features);
CREATE INDEX IF NOT EXISTS tenants_tables_gin ON tenants USING GIN (tables);

-- Create trigger to maintain updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at 
    BEFORE UPDATE ON tenants 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert demo tenants for development
INSERT INTO tenants (host, slug, theme_slug, theme_version, theme_json, status) VALUES
    ('localhost', 'topcoach-demo', 'default', '1.0.0', '{
        "meta": {"name": "TopCoach Default", "version": "1.0.0", "description": "Default TopCoach theme"},
        "fonts": {"heading": {"family": "Poppins, system-ui, sans-serif", "weight": 600}, "body": {"family": "Poppins, system-ui, sans-serif", "weight": 400}},
        "colors": {"brand": "#0ea5e9", "accent": "#0284c7", "text": {"primary": "#0f172a", "secondary": "#64748b"}, "surface": {"1": "#ffffff", "2": "#f8fafc"}, "border": "#e2e8f0", "fill": "#f1f5f9"},
        "radius": {"sm": 6, "md": 8, "lg": 12, "xl": 16},
        "shadow": {"e1": "0 1px 2px rgba(0, 0, 0, 0.02)", "e2": "0 2px 4px rgba(0, 0, 0, 0.03)"},
        "semantic": {"success": "#22c55e", "warning": "#f59e0b", "error": "#ef4444"},
        "assets": {"logo": "/brands/default/logo.svg", "banner": "/brands/default/banner.svg"}
    }', 'active'),
    ('ironfit.localhost', 'ironfit-demo', 'ironfit', '1.0.0', '{
        "meta": {"name": "IronFit", "version": "1.0.0", "description": "Bold fitness theme"},
        "fonts": {"heading": {"family": "Roboto Slab, serif", "weight": 700}, "body": {"family": "Open Sans, system-ui, sans-serif", "weight": 400}},
        "colors": {"brand": "#ea580c", "accent": "#dc2626", "text": {"primary": "#1c1917", "secondary": "#57534e"}, "surface": {"1": "#fafaf9", "2": "#f5f5f4"}, "border": "#e7e5e4", "fill": "#f5f5f4"},
        "radius": {"sm": 8, "md": 12, "lg": 16, "xl": 20},
        "shadow": {"e1": "0 1px 2px rgba(234, 88, 12, 0.03)", "e2": "0 2px 4px rgba(234, 88, 12, 0.04)"},
        "semantic": {"success": "#16a34a", "warning": "#d97706", "error": "#dc2626"},
        "assets": {"logo": "/brands/ironfit/logo.svg", "banner": "/brands/ironfit/banner.svg"}
    }', 'active'),
    ('zencoach.localhost', 'zen-coach-demo', 'zen-coach', '1.0.0', '{
        "meta": {"name": "Zen Coach", "version": "1.0.0", "description": "Calm wellness theme"},
        "fonts": {"heading": {"family": "Playfair Display, serif", "weight": 500}, "body": {"family": "Lato, system-ui, sans-serif", "weight": 400}},
        "colors": {"brand": "#059669", "accent": "#047857", "text": {"primary": "#1f2937", "secondary": "#6b7280"}, "surface": {"1": "#f9fafb", "2": "#f3f4f6"}, "border": "#d1d5db", "fill": "#e5e7eb"},
        "radius": {"sm": 12, "md": 16, "lg": 20, "xl": 24},
        "shadow": {"e1": "0 1px 2px rgba(5, 150, 105, 0.02)", "e2": "0 2px 4px rgba(5, 150, 105, 0.03)"},
        "semantic": {"success": "#10b981", "warning": "#f59e0b", "error": "#f87171"},
        "assets": {"logo": "/brands/zen-coach/logo.svg", "banner": "/brands/zen-coach/banner.svg"}
    }', 'active')
ON CONFLICT (host) DO NOTHING;

-- Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- No policies by default - only service role can read/write
-- This prevents client-side SDK from leaking secrets

-- Comment for documentation
COMMENT ON TABLE tenants IS 'Multi-tenant configuration store with encrypted secrets';
COMMENT ON COLUMN tenants.host IS 'Normalized domain (lowercase, no port in production)';
COMMENT ON COLUMN tenants.airtable_api_key_enc IS 'AES-GCM encrypted Airtable API key';
COMMENT ON COLUMN tenants.tables IS 'Airtable table configuration mapping';
COMMENT ON COLUMN tenants.features IS 'Feature flags and tenant-specific configuration';
