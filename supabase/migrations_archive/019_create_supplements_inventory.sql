-- Create supplements inventory management tables
-- All tables are tenant-scoped with RLS following the pattern from nutrition and training tables
-- =====================================================
-- SUPPLEMENT INVENTORY
-- =====================================================
-- Centralized inventory of supplements managed by trainers
CREATE TABLE IF NOT EXISTS supplement_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    images TEXT [] DEFAULT '{}',
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT name_not_empty CHECK (name != ''),
    CONSTRAINT unit_not_empty CHECK (unit != ''),
    CONSTRAINT quantity_non_negative CHECK (quantity >= 0),
    CONSTRAINT max_5_images CHECK (
        array_length(images, 1) IS NULL
        OR array_length(images, 1) <= 5
    )
);
-- =====================================================
-- CLIENT SUPPLEMENT ASSIGNMENTS
-- =====================================================
-- Assignments of supplements from inventory to clients
CREATE TABLE IF NOT EXISTS client_supplement_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    supplement_id UUID REFERENCES supplement_inventory(id) ON DELETE
    SET NULL,
        -- Denormalized fields for orphaned assignments (when supplement deleted from inventory)
        supplement_name TEXT NOT NULL,
        supplement_description TEXT,
        -- Assignment-specific details
        dosage TEXT NOT NULL,
        frequency TEXT NOT NULL,
        timing TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (
            status IN ('active', 'paused', 'discontinued')
        ),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT supplement_name_not_empty CHECK (supplement_name != ''),
        CONSTRAINT dosage_not_empty CHECK (dosage != ''),
        CONSTRAINT frequency_not_empty CHECK (frequency != ''),
        CONSTRAINT timing_not_empty CHECK (timing != '')
);
-- =====================================================
-- INDEXES
-- =====================================================
-- Supplement inventory indexes
CREATE INDEX IF NOT EXISTS supplement_inventory_tenant_idx ON supplement_inventory(tenant_host);
CREATE INDEX IF NOT EXISTS supplement_inventory_trainer_idx ON supplement_inventory(trainer_id);
CREATE INDEX IF NOT EXISTS supplement_inventory_archived_idx ON supplement_inventory(is_archived);
CREATE INDEX IF NOT EXISTS supplement_inventory_name_idx ON supplement_inventory(name);
-- Client supplement assignments indexes
CREATE INDEX IF NOT EXISTS client_supplement_assignments_tenant_idx ON client_supplement_assignments(tenant_host);
CREATE INDEX IF NOT EXISTS client_supplement_assignments_client_idx ON client_supplement_assignments(client_id);
CREATE INDEX IF NOT EXISTS client_supplement_assignments_trainer_idx ON client_supplement_assignments(trainer_id);
CREATE INDEX IF NOT EXISTS client_supplement_assignments_supplement_idx ON client_supplement_assignments(supplement_id);
CREATE INDEX IF NOT EXISTS client_supplement_assignments_status_idx ON client_supplement_assignments(status);
-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_supplement_inventory_updated_at BEFORE
UPDATE ON supplement_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_supplement_assignments_updated_at BEFORE
UPDATE ON client_supplement_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE supplement_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_supplement_assignments ENABLE ROW LEVEL SECURITY;
-- =====================================================
-- RLS POLICIES - SUPPLEMENT INVENTORY
-- =====================================================
-- Trainers can manage their supplement inventory (authorization handled at application level)
CREATE POLICY "Trainers can manage supplement inventory" ON supplement_inventory FOR ALL TO anon,
authenticated USING (true) WITH CHECK (true);
-- =====================================================
-- RLS POLICIES - CLIENT SUPPLEMENT ASSIGNMENTS
-- =====================================================
-- Trainers can manage supplement assignments (authorization handled at application level)
CREATE POLICY "Trainers can manage supplement assignments" ON client_supplement_assignments FOR ALL TO anon,
authenticated USING (true) WITH CHECK (true);
-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE supplement_inventory IS 'Centralized inventory of supplements managed by trainers';
COMMENT ON TABLE client_supplement_assignments IS 'Assignments of supplements from inventory to specific clients';
COMMENT ON COLUMN supplement_inventory.images IS 'Array of image URLs (max 5 images per supplement)';
COMMENT ON COLUMN supplement_inventory.is_archived IS 'Soft delete flag - archived items not shown in inventory picker';
COMMENT ON COLUMN client_supplement_assignments.supplement_id IS 'Reference to inventory item - SET NULL on delete to preserve assignment data';
COMMENT ON COLUMN client_supplement_assignments.supplement_name IS 'Denormalized product name - preserved when inventory item deleted';
COMMENT ON COLUMN client_supplement_assignments.supplement_description IS 'Denormalized product description - preserved when inventory item deleted';
-- =====================================================
-- STORAGE BUCKET POLICIES
-- =====================================================
-- Note: The 'supplement-images' bucket needs to be created manually in Supabase Dashboard
-- Settings: Public bucket, 2MB file size limit, allowed types: image/png, image/jpeg, image/jpg, image/webp
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow supplement image upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow supplement image update" ON storage.objects;
DROP POLICY IF EXISTS "Allow supplement image delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read supplement images" ON storage.objects;
-- Allow authenticated users to upload supplement images
CREATE POLICY "Allow supplement image upload" ON storage.objects FOR
INSERT TO anon,
    authenticated WITH CHECK (bucket_id = 'supplement-images');
-- Allow authenticated users to update supplement images
CREATE POLICY "Allow supplement image update" ON storage.objects FOR
UPDATE TO anon,
    authenticated USING (bucket_id = 'supplement-images');
-- Allow authenticated users to delete supplement images
CREATE POLICY "Allow supplement image delete" ON storage.objects FOR DELETE TO anon,
authenticated USING (bucket_id = 'supplement-images');
-- Allow public read access to all supplement images
CREATE POLICY "Allow public read supplement images" ON storage.objects FOR
SELECT TO anon,
    public USING (bucket_id = 'supplement-images');