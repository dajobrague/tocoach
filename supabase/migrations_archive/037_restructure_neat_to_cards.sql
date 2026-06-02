-- Restructure NEAT from fixed weekday goals to flexible cards
-- This migration:
-- 1. Creates new client_neat_cards table with flexible structure
-- 2. Drops old client_neat_goals table
-- 3. Sets up indexes, triggers, and RLS policies
-- =====================================================
-- CREATE NEW TABLE: client_neat_cards
-- =====================================================
CREATE TABLE IF NOT EXISTS client_neat_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    label TEXT NOT NULL,
    card_order INTEGER NOT NULL DEFAULT 0,
    steps_goal INTEGER CHECK (
        steps_goal IS NULL
        OR steps_goal >= 0
    ),
    notes TEXT,
    weekdays INTEGER [] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- =====================================================
-- DROP OLD TABLE
-- =====================================================
DROP TABLE IF EXISTS client_neat_goals CASCADE;
-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS client_neat_cards_tenant_idx ON client_neat_cards(tenant_host);
CREATE INDEX IF NOT EXISTS client_neat_cards_client_idx ON client_neat_cards(client_id, tenant_host);
CREATE INDEX IF NOT EXISTS client_neat_cards_order_idx ON client_neat_cards(client_id, tenant_host, card_order);
-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_client_neat_cards_updated_at BEFORE
UPDATE ON client_neat_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE client_neat_cards ENABLE ROW LEVEL SECURITY;
-- =====================================================
-- RLS POLICIES
-- =====================================================
-- Trainers can manage NEAT cards (authorization handled at application level)
CREATE POLICY "Trainers can manage NEAT cards" ON client_neat_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Allow anon access for all operations (authorization handled at application level)
CREATE POLICY "Anon can manage NEAT cards" ON client_neat_cards FOR ALL TO anon USING (true) WITH CHECK (true);
-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE client_neat_cards IS 'NEAT activity cards for clients - flexible daily step goals with custom labels';
COMMENT ON COLUMN client_neat_cards.label IS 'Custom label for the NEAT card (e.g., "Día de entrenamiento", "Lunes", "Sesión de ciclismo")';
COMMENT ON COLUMN client_neat_cards.card_order IS 'Display order of cards';
COMMENT ON COLUMN client_neat_cards.steps_goal IS 'Daily step count goal';
COMMENT ON COLUMN client_neat_cards.weekdays IS 'Optional array of weekdays this card applies to (0=Sunday, 1=Monday, ..., 6=Saturday)';
COMMENT ON COLUMN client_neat_cards.notes IS 'Additional notes for the NEAT card';