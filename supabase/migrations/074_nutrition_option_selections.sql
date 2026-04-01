-- Client-selected meal option per calendar day (optional telemetry for trainers).

CREATE TABLE nutrition_option_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    meal_id UUID NOT NULL REFERENCES nutrition_meals (id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES nutrition_meal_options (id) ON DELETE CASCADE,
    selected_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT nutrition_option_selections_client_meal_date_uniq UNIQUE (client_id, meal_id, selected_date)
);

COMMENT ON TABLE nutrition_option_selections IS 'Which nutrition_meal_options row a client chose for a given calendar day; one row per client/meal/date.';

CREATE INDEX nutrition_option_selections_client_date_idx ON nutrition_option_selections (client_id, selected_date);

CREATE INDEX nutrition_option_selections_meal_id_idx ON nutrition_option_selections (meal_id);

ALTER TABLE nutrition_option_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage nutrition option selections" ON nutrition_option_selections FOR ALL TO anon,
authenticated USING (true)
WITH
    CHECK (true);

COMMENT ON POLICY "Trainers can manage nutrition option selections" ON nutrition_option_selections IS 'Permissive access for API routes using anon; authorization enforced in application layer.';
