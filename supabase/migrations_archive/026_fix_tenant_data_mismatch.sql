-- Fix tenant data mismatch between trainers and tenants tables
-- This ensures trainers.tenant_host values exist in tenants.host
-- First, let's check for mismatches (this is just for diagnosis)
-- Uncomment to see trainers without matching tenants:
-- SELECT t.id, t.email, t.tenant_host 
-- FROM trainers t
-- LEFT JOIN tenants tn ON tn.host = t.tenant_host
-- WHERE tn.host IS NULL;
-- Option 1: Create missing tenant records for trainers
-- This creates tenant entries for any trainer whose tenant_host doesn't exist in tenants
INSERT INTO tenants (
        host,
        slug,
        theme_slug,
        theme_json,
        status,
        trainer_id
    )
SELECT t.tenant_host,
    COALESCE(SPLIT_PART(t.tenant_host, '.', 1), t.tenant_host) as slug,
    'default',
    '{
        "meta": {"name": "Default Theme", "version": "1.0.0"},
        "fonts": {"heading": {"family": "Poppins", "weight": 600}, "body": {"family": "Poppins", "weight": 400}},
        "colors": {"brand": "#0ea5e9", "accent": "#0284c7", "text": {"primary": "#0f172a", "secondary": "#64748b"}, "surface": {"1": "#ffffff", "2": "#f8fafc"}, "border": "#e2e8f0", "fill": "#f1f5f9"},
        "radius": {"sm": 6, "md": 8, "lg": 12, "xl": 16},
        "shadow": {"e1": "0 1px 2px rgba(0, 0, 0, 0.02)", "e2": "0 2px 4px rgba(0, 0, 0, 0.03)"},
        "semantic": {"success": "#22c55e", "warning": "#f59e0b", "error": "#ef4444"},
        "assets": {"logo": "/brands/default/logo.svg", "banner": "/brands/default/banner.svg"}
    }'::jsonb,
    'active',
    t.id
FROM trainers t
    LEFT JOIN tenants tn ON tn.host = t.tenant_host
WHERE tn.host IS NULL ON CONFLICT (host) DO NOTHING;
-- Update trainer_id in tenants if not set
UPDATE tenants
SET trainer_id = t.id
FROM trainers t
WHERE tenants.host = t.tenant_host
    AND tenants.trainer_id IS NULL;
-- Comment
COMMENT ON TABLE tenants IS 'Multi-tenant configuration - each trainer has a tenant record';