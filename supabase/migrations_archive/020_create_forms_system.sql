-- Create forms system tables for dynamic form management
-- Supports Check-ins Semanales and Hábitos Diarios with JSON-based configurations
-- =====================================================
-- FORM TEMPLATES TABLE
-- =====================================================
-- Stores default form templates that serve as base for all clients
CREATE TABLE IF NOT EXISTS form_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    form_type TEXT NOT NULL CHECK (form_type IN ('checkins', 'habits')),
    name TEXT NOT NULL,
    description TEXT,
    questions_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_form_type UNIQUE (tenant_host, form_type)
);
-- =====================================================
-- CLIENT FORM CONFIGURATIONS TABLE
-- =====================================================
-- Stores per-client form configurations (overrides or customizations)
CREATE TABLE IF NOT EXISTS client_form_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    form_type TEXT NOT NULL CHECK (form_type IN ('checkins', 'habits')),
    questions_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    uses_template BOOLEAN DEFAULT true,
    template_id UUID REFERENCES form_templates(id) ON DELETE
    SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_client_form_type UNIQUE (client_id, form_type)
);
-- =====================================================
-- FORM RESPONSES TABLE
-- =====================================================
-- Stores actual form submissions
CREATE TABLE IF NOT EXISTS form_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    form_type TEXT NOT NULL CHECK (form_type IN ('checkins', 'habits')),
    response_date DATE NOT NULL DEFAULT CURRENT_DATE,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_answers CHECK (jsonb_typeof(answers) = 'object')
);
-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
-- Form templates indexes
CREATE INDEX IF NOT EXISTS form_templates_tenant_idx ON form_templates(tenant_host);
CREATE INDEX IF NOT EXISTS form_templates_form_type_idx ON form_templates(form_type);
-- Client form configs indexes
CREATE INDEX IF NOT EXISTS client_form_configs_tenant_idx ON client_form_configs(tenant_host);
CREATE INDEX IF NOT EXISTS client_form_configs_client_idx ON client_form_configs(client_id);
CREATE INDEX IF NOT EXISTS client_form_configs_composite_idx ON client_form_configs(client_id, form_type);
CREATE INDEX IF NOT EXISTS client_form_configs_template_idx ON client_form_configs(template_id);
-- Form responses indexes
CREATE INDEX IF NOT EXISTS form_responses_tenant_idx ON form_responses(tenant_host);
CREATE INDEX IF NOT EXISTS form_responses_client_idx ON form_responses(client_id);
CREATE INDEX IF NOT EXISTS form_responses_composite_idx ON form_responses(client_id, form_type, response_date);
CREATE INDEX IF NOT EXISTS form_responses_date_idx ON form_responses(response_date);
CREATE INDEX IF NOT EXISTS form_responses_submitted_idx ON form_responses(submitted_at);
-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS form_responses_answers_gin_idx ON form_responses USING GIN (answers);
CREATE INDEX IF NOT EXISTS form_templates_questions_gin_idx ON form_templates USING GIN (questions_config);
CREATE INDEX IF NOT EXISTS client_form_configs_questions_gin_idx ON client_form_configs USING GIN (questions_config);
-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Enable RLS on all tables
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_form_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
-- Form Templates Policies
-- Trainers can manage templates for their tenant
CREATE POLICY form_templates_tenant_access ON form_templates FOR ALL USING (
    tenant_host IN (
        SELECT host
        FROM tenants
        WHERE trainer_id = (
                SELECT id
                FROM trainers
                WHERE id = auth.uid()
            )
    )
);
-- Client Form Configs Policies
-- Trainers can manage configs for clients in their tenant
CREATE POLICY client_form_configs_trainer_access ON client_form_configs FOR ALL USING (
    tenant_host IN (
        SELECT host
        FROM tenants
        WHERE trainer_id = (
                SELECT id
                FROM trainers
                WHERE id = auth.uid()
            )
    )
);
-- Clients can read their own form configs (for filling out forms)
CREATE POLICY client_form_configs_client_read ON client_form_configs FOR
SELECT USING (
        client_id IN (
            SELECT id
            FROM clients
            WHERE id = client_id
        )
    );
-- Form Responses Policies
-- Trainers can read all responses for clients in their tenant
CREATE POLICY form_responses_trainer_access ON form_responses FOR ALL USING (
    tenant_host IN (
        SELECT host
        FROM tenants
        WHERE trainer_id = (
                SELECT id
                FROM trainers
                WHERE id = auth.uid()
            )
    )
);
-- Clients can manage their own responses
CREATE POLICY form_responses_client_access ON form_responses FOR ALL USING (
    client_id IN (
        SELECT id
        FROM clients
        WHERE id = client_id
    )
);
-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_forms_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Create triggers for updated_at
CREATE TRIGGER update_form_templates_updated_at BEFORE
UPDATE ON form_templates FOR EACH ROW EXECUTE FUNCTION update_forms_updated_at();
CREATE TRIGGER update_client_form_configs_updated_at BEFORE
UPDATE ON client_form_configs FOR EACH ROW EXECUTE FUNCTION update_forms_updated_at();
CREATE TRIGGER update_form_responses_updated_at BEFORE
UPDATE ON form_responses FOR EACH ROW EXECUTE FUNCTION update_forms_updated_at();
-- =====================================================
-- HELPER FUNCTION: Get or Create Client Form Config
-- =====================================================
-- This function retrieves a client's form config, or creates one from template if it doesn't exist
CREATE OR REPLACE FUNCTION get_or_create_client_form_config(
        p_client_id BIGINT,
        p_form_type TEXT,
        p_tenant_host TEXT
    ) RETURNS TABLE (
        id UUID,
        tenant_host TEXT,
        client_id BIGINT,
        form_type TEXT,
        questions_config JSONB,
        uses_template BOOLEAN,
        template_id UUID,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
    ) AS $$
DECLARE v_config_exists BOOLEAN;
v_template_id UUID;
v_template_config JSONB;
BEGIN -- Check if config already exists
SELECT EXISTS (
        SELECT 1
        FROM client_form_configs
        WHERE client_form_configs.client_id = p_client_id
            AND client_form_configs.form_type = p_form_type
    ) INTO v_config_exists;
-- If config exists, return it
IF v_config_exists THEN RETURN QUERY
SELECT cfc.id,
    cfc.tenant_host,
    cfc.client_id,
    cfc.form_type,
    cfc.questions_config,
    cfc.uses_template,
    cfc.template_id,
    cfc.created_at,
    cfc.updated_at
FROM client_form_configs cfc
WHERE cfc.client_id = p_client_id
    AND cfc.form_type = p_form_type;
ELSE -- Get template for this form type and tenant
SELECT ft.id,
    ft.questions_config INTO v_template_id,
    v_template_config
FROM form_templates ft
WHERE ft.tenant_host = p_tenant_host
    AND ft.form_type = p_form_type
    AND ft.is_active = true
LIMIT 1;
-- Create new config from template
IF v_template_id IS NOT NULL THEN RETURN QUERY
INSERT INTO client_form_configs (
        tenant_host,
        client_id,
        form_type,
        questions_config,
        uses_template,
        template_id
    )
VALUES (
        p_tenant_host,
        p_client_id,
        p_form_type,
        v_template_config,
        true,
        v_template_id
    )
RETURNING client_form_configs.id,
    client_form_configs.tenant_host,
    client_form_configs.client_id,
    client_form_configs.form_type,
    client_form_configs.questions_config,
    client_form_configs.uses_template,
    client_form_configs.template_id,
    client_form_configs.created_at,
    client_form_configs.updated_at;
END IF;
END IF;
END;
$$ LANGUAGE plpgsql;
-- =====================================================
-- SEED DATA: DEFAULT FORM TEMPLATES
-- =====================================================
-- Note: These will be inserted for ALL tenants on first run
-- Each tenant will get their own copy of the templates
-- Insert Check-ins Semanales template
-- This uses the default questions from the UI
DO $$
DECLARE t_host TEXT;
BEGIN FOR t_host IN
SELECT host
FROM tenants LOOP
INSERT INTO form_templates (
        tenant_host,
        form_type,
        name,
        description,
        questions_config,
        is_active
    )
VALUES (
        t_host,
        'checkins',
        'Check-in Semanal',
        'Formulario de revisión semanal para seguimiento de progreso del cliente',
        '[
                {
                    "id": "personal_life",
                    "label": "Vida Personal",
                    "fullQuestion": "¿Cómo va todo a nivel personal?",
                    "icon": "solar:user-heart-bold",
                    "type": "text",
                    "enabled": true,
                    "required": true
                },
                {
                    "id": "gym_achievement",
                    "label": "Triunfo en el Gimnasio",
                    "fullQuestion": "Triunfo que has conseguido en el gimnasio desde última revisión",
                    "icon": "solar:cup-star-bold",
                    "type": "text",
                    "enabled": true,
                    "required": true
                },
                {
                    "id": "other_victory",
                    "label": "Otra Victoria",
                    "fullQuestion": "¿Alguna otra victoria que celebrar?",
                    "icon": "solar:star-circle-bold",
                    "type": "text",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "biggest_challenge",
                    "label": "Mayor Desafío",
                    "fullQuestion": "¿Cuál ha sido el mayor desafío al que te has enfrentado?",
                    "icon": "solar:shield-warning-bold",
                    "type": "text",
                    "enabled": true,
                    "required": true
                },
                {
                    "id": "goals_completed",
                    "label": "Objetivos Cumplidos",
                    "fullQuestion": "¿Has cumplido objetivos que te marcaste en nuestra última revisión?",
                    "icon": "solar:check-square-bold",
                    "type": "boolean",
                    "enabled": true,
                    "required": true
                },
                {
                    "id": "goals_impediment",
                    "label": "Impedimentos",
                    "fullQuestion": "¿Qué te lo ha impedido?",
                    "icon": "solar:close-circle-bold",
                    "type": "text",
                    "enabled": true,
                    "required": false,
                    "conditionalOn": "goals_completed",
                    "conditionalValue": false
                },
                {
                    "id": "focus_next_weeks",
                    "label": "Enfoque Próximas Semanas",
                    "fullQuestion": "¿En qué quieres enfocarte especialmente para mejorar en estas próximas semanas?",
                    "icon": "solar:target-bold",
                    "type": "text",
                    "enabled": true,
                    "required": true
                },
                {
                    "id": "service_rating",
                    "label": "Valoración del Servicio",
                    "fullQuestion": "¿Cómo valoras el servicio que te estamos dando?",
                    "icon": "solar:star-bold",
                    "type": "rating",
                    "enabled": true,
                    "required": true
                },
                {
                    "id": "service_details",
                    "label": "Detalles del Servicio",
                    "fullQuestion": "¿Me puedes dar más detalles?",
                    "icon": "solar:chat-round-dots-bold",
                    "type": "text",
                    "enabled": true,
                    "required": false,
                    "conditionalOn": "service_rating",
                    "conditionalValue": true
                },
                {
                    "id": "photos",
                    "label": "Fotos de Progreso",
                    "icon": "solar:camera-bold",
                    "type": "group",
                    "enabled": true,
                    "required": false,
                    "subQuestions": [
                        {
                            "id": "photo_front",
                            "label": "Foto de Frente",
                            "icon": "solar:user-bold",
                            "type": "photo",
                            "enabled": true,
                            "required": false
                        },
                        {
                            "id": "photo_side",
                            "label": "Foto de Perfil",
                            "icon": "solar:user-bold",
                            "type": "photo",
                            "enabled": true,
                            "required": false
                        },
                        {
                            "id": "photo_back",
                            "label": "Foto de Espaldas",
                            "icon": "solar:user-bold",
                            "type": "photo",
                            "enabled": true,
                            "required": false
                        }
                    ]
                },
                {
                    "id": "body_measurements",
                    "label": "Medidas Corporales",
                    "icon": "solar:ruler-bold",
                    "type": "group",
                    "enabled": true,
                    "required": false,
                    "subQuestions": [
                        {
                            "id": "chest",
                            "label": "Pecho",
                            "icon": "solar:ruler-cross-pen-bold",
                            "type": "number",
                            "unit": "cm",
                            "enabled": true,
                            "required": false
                        },
                        {
                            "id": "shoulders",
                            "label": "Hombros",
                            "icon": "solar:ruler-cross-pen-bold",
                            "type": "number",
                            "unit": "cm",
                            "enabled": true,
                            "required": false
                        },
                        {
                            "id": "arm",
                            "label": "Brazo",
                            "icon": "solar:ruler-cross-pen-bold",
                            "type": "number",
                            "unit": "cm",
                            "enabled": true,
                            "required": false
                        },
                        {
                            "id": "above_navel",
                            "label": "Sobre el Ombligo 3cm",
                            "icon": "solar:ruler-cross-pen-bold",
                            "type": "number",
                            "unit": "cm",
                            "enabled": true,
                            "required": false
                        },
                        {
                            "id": "below_navel",
                            "label": "Bajo el Ombligo 3cm",
                            "icon": "solar:ruler-cross-pen-bold",
                            "type": "number",
                            "unit": "cm",
                            "enabled": true,
                            "required": false
                        },
                        {
                            "id": "groin",
                            "label": "Ingle",
                            "icon": "solar:ruler-cross-pen-bold",
                            "type": "number",
                            "unit": "cm",
                            "enabled": true,
                            "required": false
                        },
                        {
                            "id": "thigh",
                            "label": "Muslo",
                            "icon": "solar:ruler-cross-pen-bold",
                            "type": "number",
                            "unit": "cm",
                            "enabled": true,
                            "required": false
                        },
                        {
                            "id": "calf",
                            "label": "Gemelo",
                            "icon": "solar:ruler-cross-pen-bold",
                            "type": "number",
                            "unit": "cm",
                            "enabled": true,
                            "required": false
                        }
                    ]
                },
                {
                    "id": "body_weight",
                    "label": "Peso Corporal",
                    "icon": "solar:scale-bold",
                    "type": "number",
                    "unit": "kg",
                    "enabled": true,
                    "required": true
                }
            ]'::jsonb,
        true
    ) ON CONFLICT (tenant_host, form_type) DO NOTHING;
END LOOP;
END $$;
-- Insert Hábitos Diarios template
DO $$
DECLARE t_host TEXT;
BEGIN FOR t_host IN
SELECT host
FROM tenants LOOP
INSERT INTO form_templates (
        tenant_host,
        form_type,
        name,
        description,
        questions_config,
        is_active
    )
VALUES (
        t_host,
        'habits',
        'Hábitos Diarios',
        'Seguimiento diario de hábitos, nutrición y bienestar',
        '[
                {
                    "id": "energy_levels",
                    "label": "Niveles de Energía",
                    "fullQuestion": "Niveles de energía durante el día",
                    "icon": "solar:bolt-bold",
                    "type": "rating",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "stress_levels",
                    "label": "Manejo del Estrés",
                    "fullQuestion": "¿Qué tal has sobrellevado el estrés?",
                    "icon": "solar:shield-warning-bold",
                    "type": "rating",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "illness_signs",
                    "label": "Signos de Enfermedad",
                    "fullQuestion": "¿Has tenido algún signo de enfermedad, infección, dolor?",
                    "icon": "solar:health-bold",
                    "type": "boolean",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "illness_details",
                    "label": "Detalles de Enfermedad",
                    "fullQuestion": "Más detalles",
                    "icon": "solar:notes-bold",
                    "type": "text",
                    "enabled": true,
                    "required": false,
                    "conditionalOn": "illness_signs",
                    "conditionalValue": true
                },
                {
                    "id": "steps",
                    "label": "Pasos del Día",
                    "fullQuestion": "¿Cuántos pasos has hecho hoy?",
                    "icon": "solar:walking-bold",
                    "type": "number",
                    "unit": "pasos",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "other_activity",
                    "label": "Otra Actividad Física",
                    "fullQuestion": "¿Otra actividad física exigente?",
                    "icon": "solar:running-bold",
                    "type": "boolean",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "other_activity_details",
                    "label": "Detalles de Actividad",
                    "fullQuestion": "Más detalles",
                    "icon": "solar:notes-bold",
                    "type": "text",
                    "enabled": true,
                    "required": false,
                    "conditionalOn": "other_activity",
                    "conditionalValue": true
                },
                {
                    "id": "special_comment",
                    "label": "Comentario Especial",
                    "fullQuestion": "Comentario especial",
                    "icon": "solar:chat-round-dots-bold",
                    "type": "boolean",
                    "enabled": false,
                    "required": false
                },
                {
                    "id": "sun_exposure",
                    "label": "Exposición Solar",
                    "fullQuestion": "Horas de exposición al sol durante el día",
                    "icon": "solar:sun-bold",
                    "type": "number",
                    "unit": "horas",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "macro_tracking",
                    "label": "Seguimiento de Macros",
                    "fullQuestion": "¿Seguimiento de macros hoy?",
                    "icon": "solar:pie-chart-bold",
                    "type": "group",
                    "enabled": true,
                    "required": false,
                    "subQuestions": [
                        {
                            "id": "calories",
                            "label": "Calorías Totales",
                            "icon": "solar:fire-bold",
                            "type": "number",
                            "unit": "kcal",
                            "enabled": true,
                            "required": false
                        },
                        {
                            "id": "protein",
                            "label": "Proteína",
                            "icon": "solar:nutrition-bold",
                            "type": "number",
                            "unit": "g",
                            "enabled": true,
                            "required": false
                        },
                        {
                            "id": "carbs",
                            "label": "Carbohidratos",
                            "icon": "solar:leaf-bold",
                            "type": "number",
                            "unit": "g",
                            "enabled": true,
                            "required": false
                        },
                        {
                            "id": "fats",
                            "label": "Grasas",
                            "icon": "solar:drop-bold",
                            "type": "number",
                            "unit": "g",
                            "enabled": true,
                            "required": false
                        }
                    ]
                },
                {
                    "id": "hunger_levels",
                    "label": "Niveles de Hambre",
                    "fullQuestion": "¿Cómo han sido tus niveles de hambre?",
                    "icon": "solar:hamburger-bold",
                    "type": "rating",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "adherence",
                    "label": "Adherencia al Plan",
                    "fullQuestion": "¿Cómo ha sido la adherencia?",
                    "icon": "solar:check-circle-bold",
                    "type": "rating",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "adherence_reason",
                    "label": "Razón de No Adherencia",
                    "fullQuestion": "¿Por qué no te has podido ceñir al plan?",
                    "icon": "solar:question-circle-bold",
                    "type": "text",
                    "enabled": true,
                    "required": false,
                    "conditionalOn": "adherence",
                    "conditionalValue": true
                },
                {
                    "id": "caffeine",
                    "label": "Consumo de Cafeína",
                    "fullQuestion": "¿Cuánta cafeína se ha consumido?",
                    "icon": "solar:cup-hot-bold",
                    "type": "number",
                    "unit": "mg",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "supplementation",
                    "label": "Suplementación",
                    "fullQuestion": "Suplementación",
                    "icon": "solar:pill-bold",
                    "type": "text",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "bedtime",
                    "label": "Hora de Acostar",
                    "fullQuestion": "¿A qué hora te acostaste ayer?",
                    "icon": "solar:moon-stars-bold",
                    "type": "text",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "wake_time",
                    "label": "Hora de Despertar",
                    "fullQuestion": "¿A qué hora te has despertado hoy?",
                    "icon": "solar:sun-fog-bold",
                    "type": "text",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "sleep_hours",
                    "label": "Horas de Sueño",
                    "fullQuestion": "¿Cuántas horas has dormido en total?",
                    "icon": "solar:sleep-bold",
                    "type": "number",
                    "unit": "horas",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "morning_feeling",
                    "label": "Sensación al Despertar",
                    "fullQuestion": "Al salir de cama esta mañana sentías que",
                    "icon": "solar:smile-circle-bold",
                    "type": "rating",
                    "enabled": true,
                    "required": false
                },
                {
                    "id": "morning_feeling_details",
                    "label": "Detalles de Despertar",
                    "fullQuestion": "Más detalles",
                    "icon": "solar:notes-bold",
                    "type": "text",
                    "enabled": true,
                    "required": false,
                    "conditionalOn": "morning_feeling",
                    "conditionalValue": true
                }
            ]'::jsonb,
        true
    ) ON CONFLICT (tenant_host, form_type) DO NOTHING;
END LOOP;
END $$;