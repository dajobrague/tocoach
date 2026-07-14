-- Common foods seed (nutrition-v2).
--
-- Open Food Facts is a packaged-products database, so raw/whole foods
-- (fruit, plain chicken, rice...) are effectively missing from search.
-- This migration adds a small GLOBAL `common_foods` table seeded with
-- everyday foods (Spanish names, USDA FoodData Central-derived values per
-- 100 g) that the food search merges in before/alongside OFF results.
--
-- It also widens ingredients.source to accept 'seed' so a selected common
-- food can be copied into the tenant ingredient cache like any other source.

-- 1) Allow 'seed' as an ingredient source.
ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_source_check;
ALTER TABLE ingredients
    ADD CONSTRAINT ingredients_source_check
    CHECK (source IN ('off', 'manual', 'seed'));

COMMENT ON COLUMN ingredients.source IS
    'Originating FoodSource: off (Open Food Facts), manual, or seed (common_foods).';

-- 2) Global common foods table (read-only for app roles; seeded here).
CREATE TABLE IF NOT EXISTS common_foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Display name (Spanish). May include synonyms in parentheses so they
    -- participate in matching via name_normalized.
    name TEXT NOT NULL CHECK (name <> ''),
    -- Lowercased, accent-stripped copy of name used for ILIKE matching
    -- without requiring the unaccent extension.
    name_normalized TEXT NOT NULL CHECK (name_normalized <> ''),
    category TEXT NOT NULL,
    default_unit TEXT NOT NULL DEFAULT 'g',
    kcal NUMERIC NOT NULL DEFAULT 0,
    protein_g NUMERIC NOT NULL DEFAULT 0,
    carbs_g NUMERIC NOT NULL DEFAULT 0,
    fat_g NUMERIC NOT NULL DEFAULT 0,
    sugar_g NUMERIC NOT NULL DEFAULT 0,
    fiber_g NUMERIC NOT NULL DEFAULT 0,
    sat_fat_g NUMERIC NOT NULL DEFAULT 0,
    sodium_mg NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS common_foods_name_normalized_idx
    ON common_foods (name_normalized);

ALTER TABLE common_foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS common_foods_read_anon ON common_foods;
CREATE POLICY common_foods_read_anon ON common_foods
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS common_foods_read_authenticated ON common_foods;
CREATE POLICY common_foods_read_authenticated ON common_foods
    FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE common_foods IS
    'Global seed of everyday foods (USDA-derived, per 100 g) merged into food search; not tenant-scoped.';

-- 3) Seed data. Values are per 100 g (edible portion), sodium in mg.
INSERT INTO common_foods
    (name, name_normalized, category, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sat_fat_g, sodium_mg)
VALUES
    -- Frutas
    ('Manzana', 'manzana', 'fruta', 52, 0.3, 13.8, 0.2, 10.4, 2.4, 0.03, 1),
    ('Plátano (banana)', 'platano (banana)', 'fruta', 89, 1.1, 22.8, 0.3, 12.2, 2.6, 0.11, 1),
    ('Naranja', 'naranja', 'fruta', 47, 0.9, 11.8, 0.1, 9.4, 2.4, 0.02, 0),
    ('Mandarina', 'mandarina', 'fruta', 53, 0.8, 13.3, 0.3, 10.6, 1.8, 0.04, 2),
    ('Fresa', 'fresa', 'fruta', 32, 0.7, 7.7, 0.3, 4.9, 2.0, 0.02, 1),
    ('Uva', 'uva', 'fruta', 69, 0.7, 18.1, 0.2, 15.5, 0.9, 0.05, 2),
    ('Sandía', 'sandia', 'fruta', 30, 0.6, 7.6, 0.2, 6.2, 0.4, 0.02, 1),
    ('Melón', 'melon', 'fruta', 34, 0.8, 8.2, 0.2, 7.9, 0.9, 0.05, 16),
    ('Piña', 'pina', 'fruta', 50, 0.5, 13.1, 0.1, 9.9, 1.4, 0.01, 1),
    ('Mango', 'mango', 'fruta', 60, 0.8, 15.0, 0.4, 13.7, 1.6, 0.09, 1),
    ('Pera', 'pera', 'fruta', 57, 0.4, 15.2, 0.1, 9.8, 3.1, 0.02, 1),
    ('Kiwi', 'kiwi', 'fruta', 61, 1.1, 14.7, 0.5, 9.0, 3.0, 0.03, 3),
    ('Melocotón (durazno)', 'melocoton (durazno)', 'fruta', 39, 0.9, 9.5, 0.3, 8.4, 1.5, 0.02, 0),
    ('Cereza', 'cereza', 'fruta', 63, 1.1, 16.0, 0.2, 12.8, 2.1, 0.04, 0),
    ('Arándanos', 'arandanos', 'fruta', 57, 0.7, 14.5, 0.3, 10.0, 2.4, 0.03, 1),
    ('Frambuesa', 'frambuesa', 'fruta', 52, 1.2, 11.9, 0.7, 4.4, 6.5, 0.02, 1),
    ('Limón', 'limon', 'fruta', 29, 1.1, 9.3, 0.3, 2.5, 2.8, 0.04, 2),
    ('Aguacate', 'aguacate', 'fruta', 160, 2.0, 8.5, 14.7, 0.7, 6.7, 2.13, 7),
    ('Granada', 'granada', 'fruta', 83, 1.7, 18.7, 1.2, 13.7, 4.0, 0.12, 3),
    ('Papaya', 'papaya', 'fruta', 43, 0.5, 10.8, 0.3, 7.8, 1.7, 0.08, 8),
    ('Ciruela', 'ciruela', 'fruta', 46, 0.7, 11.4, 0.3, 9.9, 1.4, 0.02, 0),
    ('Higo', 'higo', 'fruta', 74, 0.8, 19.2, 0.3, 16.3, 2.9, 0.06, 1),
    ('Dátil', 'datil', 'fruta', 277, 1.8, 75.0, 0.2, 66.5, 6.7, 0.03, 1),
    ('Coco (pulpa)', 'coco (pulpa)', 'fruta', 354, 3.3, 15.2, 33.5, 6.2, 9.0, 29.70, 20),

    -- Verduras y hortalizas
    ('Tomate', 'tomate', 'verdura', 18, 0.9, 3.9, 0.2, 2.6, 1.2, 0.03, 5),
    ('Lechuga', 'lechuga', 'verdura', 15, 1.4, 2.9, 0.2, 0.8, 1.3, 0.02, 28),
    ('Espinaca', 'espinaca', 'verdura', 23, 2.9, 3.6, 0.4, 0.4, 2.2, 0.06, 79),
    ('Brócoli', 'brocoli', 'verdura', 34, 2.8, 6.6, 0.4, 1.7, 2.6, 0.04, 33),
    ('Coliflor', 'coliflor', 'verdura', 25, 1.9, 5.0, 0.3, 1.9, 2.0, 0.13, 30),
    ('Zanahoria', 'zanahoria', 'verdura', 41, 0.9, 9.6, 0.2, 4.7, 2.8, 0.04, 69),
    ('Pepino', 'pepino', 'verdura', 15, 0.7, 3.6, 0.1, 1.7, 0.5, 0.04, 2),
    ('Calabacín', 'calabacin', 'verdura', 17, 1.2, 3.1, 0.3, 2.5, 1.0, 0.08, 8),
    ('Pimiento rojo', 'pimiento rojo', 'verdura', 31, 1.0, 6.0, 0.3, 4.2, 2.1, 0.03, 4),
    ('Pimiento verde', 'pimiento verde', 'verdura', 20, 0.9, 4.6, 0.2, 2.4, 1.7, 0.06, 3),
    ('Cebolla', 'cebolla', 'verdura', 40, 1.1, 9.3, 0.1, 4.2, 1.7, 0.04, 4),
    ('Ajo', 'ajo', 'verdura', 149, 6.4, 33.1, 0.5, 1.0, 2.1, 0.09, 17),
    ('Champiñón', 'champinon', 'verdura', 22, 3.1, 3.3, 0.3, 2.0, 1.0, 0.05, 5),
    ('Berenjena', 'berenjena', 'verdura', 25, 1.0, 5.9, 0.2, 3.5, 3.0, 0.03, 2),
    ('Espárragos', 'esparragos', 'verdura', 20, 2.2, 3.9, 0.1, 1.9, 2.1, 0.04, 2),
    ('Judías verdes', 'judias verdes', 'verdura', 31, 1.8, 7.0, 0.2, 3.3, 2.7, 0.05, 6),
    ('Alcachofa', 'alcachofa', 'verdura', 47, 3.3, 10.5, 0.2, 1.0, 5.4, 0.04, 94),
    ('Remolacha', 'remolacha', 'verdura', 43, 1.6, 9.6, 0.2, 6.8, 2.8, 0.03, 78),
    ('Apio', 'apio', 'verdura', 14, 0.7, 3.0, 0.2, 1.3, 1.6, 0.04, 80),
    ('Col rizada (kale)', 'col rizada (kale)', 'verdura', 49, 4.3, 8.8, 0.9, 2.3, 3.6, 0.09, 38),
    ('Maíz dulce', 'maiz dulce', 'verdura', 86, 3.3, 18.7, 1.4, 6.3, 2.0, 0.18, 15),
    ('Calabaza', 'calabaza', 'verdura', 26, 1.0, 6.5, 0.1, 2.8, 0.5, 0.05, 1),

    -- Tubérculos, cereales y legumbres
    ('Patata (cocida)', 'patata (cocida)', 'cereal_tuberculo', 87, 1.9, 20.1, 0.1, 0.9, 1.8, 0.03, 4),
    ('Patata (cruda)', 'patata (cruda)', 'cereal_tuberculo', 77, 2.0, 17.5, 0.1, 0.8, 2.1, 0.03, 6),
    ('Boniato (batata, cocido)', 'boniato (batata, cocido)', 'cereal_tuberculo', 90, 2.0, 20.7, 0.2, 6.5, 3.3, 0.03, 36),
    ('Arroz blanco (cocido)', 'arroz blanco (cocido)', 'cereal_tuberculo', 130, 2.7, 28.2, 0.3, 0.1, 0.4, 0.08, 1),
    ('Arroz blanco (crudo)', 'arroz blanco (crudo)', 'cereal_tuberculo', 365, 7.1, 80.0, 0.7, 0.1, 1.3, 0.18, 5),
    ('Arroz integral (cocido)', 'arroz integral (cocido)', 'cereal_tuberculo', 112, 2.3, 23.5, 0.8, 0.2, 1.8, 0.17, 4),
    ('Pasta (cocida)', 'pasta (cocida)', 'cereal_tuberculo', 158, 5.8, 30.9, 0.9, 0.6, 1.8, 0.17, 1),
    ('Pasta (cruda)', 'pasta (cruda)', 'cereal_tuberculo', 371, 13.0, 74.7, 1.5, 2.7, 3.2, 0.28, 6),
    ('Quinoa (cocida)', 'quinoa (cocida)', 'cereal_tuberculo', 120, 4.4, 21.3, 1.9, 0.9, 2.8, 0.23, 7),
    ('Cuscús (cocido)', 'cuscus (cocido)', 'cereal_tuberculo', 112, 3.8, 23.2, 0.2, 0.1, 1.4, 0.03, 5),
    ('Avena (copos)', 'avena (copos)', 'cereal_tuberculo', 389, 16.9, 66.3, 6.9, 1.0, 10.6, 1.22, 2),
    ('Pan blanco', 'pan blanco', 'cereal_tuberculo', 265, 9.0, 49.0, 3.2, 5.0, 2.7, 0.70, 491),
    ('Pan integral', 'pan integral', 'cereal_tuberculo', 247, 13.0, 41.0, 3.4, 4.3, 7.0, 0.70, 450),
    ('Tortilla de trigo (wrap)', 'tortilla de trigo (wrap)', 'cereal_tuberculo', 310, 8.3, 50.9, 7.7, 3.5, 3.4, 2.50, 660),
    ('Lentejas (cocidas)', 'lentejas (cocidas)', 'legumbre', 116, 9.0, 20.1, 0.4, 1.8, 7.9, 0.05, 2),
    ('Garbanzos (cocidos)', 'garbanzos (cocidos)', 'legumbre', 164, 8.9, 27.4, 2.6, 4.8, 7.6, 0.27, 7),
    ('Alubias negras (cocidas)', 'alubias negras (cocidas)', 'legumbre', 132, 8.9, 23.7, 0.5, 0.3, 8.7, 0.14, 1),
    ('Alubias blancas (cocidas)', 'alubias blancas (cocidas)', 'legumbre', 139, 9.7, 25.1, 0.4, 0.3, 6.3, 0.09, 2),
    ('Guisantes', 'guisantes', 'legumbre', 81, 5.4, 14.5, 0.4, 5.7, 5.1, 0.07, 5),
    ('Edamame', 'edamame', 'legumbre', 121, 11.9, 8.9, 5.2, 2.2, 5.2, 0.62, 6),
    ('Tofu firme', 'tofu firme', 'legumbre', 144, 15.8, 2.9, 8.7, 0.6, 2.3, 1.26, 14),
    ('Hummus', 'hummus', 'legumbre', 166, 7.9, 14.3, 9.6, 0.3, 6.0, 1.44, 379),

    -- Carnes y huevos
    ('Pechuga de pollo (cruda)', 'pechuga de pollo (cruda)', 'carne', 120, 22.5, 0.0, 2.6, 0.0, 0.0, 0.57, 45),
    ('Pechuga de pollo (a la plancha)', 'pechuga de pollo (a la plancha)', 'carne', 165, 31.0, 0.0, 3.6, 0.0, 0.0, 1.01, 74),
    ('Muslo de pollo (cocinado, sin piel)', 'muslo de pollo (cocinado, sin piel)', 'carne', 179, 24.6, 0.0, 8.2, 0.0, 0.0, 2.27, 95),
    ('Pechuga de pavo (cocinada)', 'pechuga de pavo (cocinada)', 'carne', 147, 30.1, 0.0, 2.1, 0.0, 0.0, 0.64, 99),
    ('Ternera magra (cocinada)', 'ternera magra (cocinada)', 'carne', 217, 26.4, 0.0, 11.8, 0.0, 0.0, 4.62, 72),
    ('Carne picada de ternera 95/5 (cruda)', 'carne picada de ternera 95/5 (cruda)', 'carne', 137, 21.4, 0.0, 5.0, 0.0, 0.0, 2.23, 66),
    ('Lomo de cerdo (cocinado)', 'lomo de cerdo (cocinado)', 'carne', 196, 27.3, 0.0, 8.9, 0.0, 0.0, 3.19, 53),
    ('Jamón serrano', 'jamon serrano', 'carne', 241, 30.5, 0.1, 13.0, 0.1, 0.0, 4.50, 1800),
    ('Jamón cocido (york)', 'jamon cocido (york)', 'carne', 107, 16.8, 1.5, 3.5, 1.2, 0.0, 1.20, 1100),
    ('Huevo entero (crudo)', 'huevo entero (crudo)', 'huevo', 143, 12.6, 0.7, 9.5, 0.4, 0.0, 3.13, 142),
    ('Huevo cocido', 'huevo cocido', 'huevo', 155, 12.6, 1.1, 10.6, 1.1, 0.0, 3.27, 124),
    ('Clara de huevo', 'clara de huevo', 'huevo', 52, 10.9, 0.7, 0.2, 0.7, 0.0, 0.00, 166),

    -- Pescados y mariscos
    ('Salmón (crudo)', 'salmon (crudo)', 'pescado', 208, 20.4, 0.0, 13.4, 0.0, 0.0, 3.05, 59),
    ('Salmón (a la plancha)', 'salmon (a la plancha)', 'pescado', 206, 22.1, 0.0, 12.4, 0.0, 0.0, 2.50, 61),
    ('Atún fresco', 'atun fresco', 'pescado', 144, 23.3, 0.0, 4.9, 0.0, 0.0, 1.26, 39),
    ('Atún en lata (al natural)', 'atun en lata (al natural)', 'pescado', 116, 25.5, 0.0, 0.8, 0.0, 0.0, 0.23, 338),
    ('Atún en lata (en aceite, escurrido)', 'atun en lata (en aceite, escurrido)', 'pescado', 198, 29.1, 0.0, 8.2, 0.0, 0.0, 1.53, 354),
    ('Merluza', 'merluza', 'pescado', 86, 17.8, 0.0, 1.3, 0.0, 0.0, 0.25, 72),
    ('Bacalao fresco', 'bacalao fresco', 'pescado', 82, 17.8, 0.0, 0.7, 0.0, 0.0, 0.13, 54),
    ('Lubina', 'lubina', 'pescado', 97, 18.4, 0.0, 2.5, 0.0, 0.0, 0.53, 68),
    ('Dorada', 'dorada', 'pescado', 100, 19.8, 0.0, 2.3, 0.0, 0.0, 0.55, 70),
    ('Sardinas en lata (en aceite, escurridas)', 'sardinas en lata (en aceite, escurridas)', 'pescado', 208, 24.6, 0.0, 11.5, 0.0, 0.0, 1.53, 307),
    ('Gambas (cocidas)', 'gambas (cocidas)', 'marisco', 99, 24.0, 0.2, 0.3, 0.0, 0.0, 0.09, 111),
    ('Mejillones (cocidos)', 'mejillones (cocidos)', 'marisco', 172, 23.8, 7.4, 4.5, 0.0, 0.0, 0.85, 369),
    ('Calamar', 'calamar', 'marisco', 92, 15.6, 3.1, 1.4, 0.0, 0.0, 0.36, 44),
    ('Pulpo (cocido)', 'pulpo (cocido)', 'marisco', 164, 29.8, 4.4, 2.1, 0.0, 0.0, 0.45, 460),

    -- Lácteos
    ('Leche entera', 'leche entera', 'lacteo', 61, 3.2, 4.8, 3.3, 5.1, 0.0, 1.87, 43),
    ('Leche semidesnatada', 'leche semidesnatada', 'lacteo', 47, 3.4, 4.9, 1.6, 4.9, 0.0, 0.98, 44),
    ('Leche desnatada', 'leche desnatada', 'lacteo', 34, 3.4, 5.0, 0.1, 5.0, 0.0, 0.06, 42),
    ('Yogur natural', 'yogur natural', 'lacteo', 61, 3.5, 4.7, 3.3, 4.7, 0.0, 2.10, 46),
    ('Yogur griego natural', 'yogur griego natural', 'lacteo', 97, 9.0, 3.9, 5.0, 4.0, 0.0, 3.50, 35),
    ('Yogur griego 0%', 'yogur griego 0%', 'lacteo', 59, 10.2, 3.6, 0.4, 3.2, 0.0, 0.10, 36),
    ('Queso fresco (tipo Burgos)', 'queso fresco (tipo burgos)', 'lacteo', 174, 12.4, 3.4, 12.9, 3.4, 0.0, 8.50, 480),
    ('Requesón (cottage)', 'requeson (cottage)', 'lacteo', 98, 11.1, 3.4, 4.3, 2.7, 0.0, 1.72, 364),
    ('Queso curado (tipo manchego)', 'queso curado (tipo manchego)', 'lacteo', 392, 26.0, 0.5, 32.0, 0.5, 0.0, 19.00, 620),
    ('Mozzarella fresca', 'mozzarella fresca', 'lacteo', 280, 22.2, 2.2, 19.5, 1.0, 0.0, 12.10, 486),
    ('Mantequilla', 'mantequilla', 'lacteo', 717, 0.9, 0.1, 81.1, 0.1, 0.0, 51.40, 576),
    ('Nata para cocinar (18%)', 'nata para cocinar (18%)', 'lacteo', 195, 2.7, 4.3, 18.3, 3.7, 0.0, 11.40, 72),

    -- Frutos secos, semillas y aceites
    ('Almendras', 'almendras', 'fruto_seco', 579, 21.2, 21.6, 49.9, 4.4, 12.5, 3.80, 1),
    ('Nueces', 'nueces', 'fruto_seco', 654, 15.2, 13.7, 65.2, 2.6, 6.7, 6.13, 2),
    ('Cacahuetes (maní)', 'cacahuetes (mani)', 'fruto_seco', 567, 25.8, 16.1, 49.2, 4.7, 8.5, 6.28, 18),
    ('Anacardos', 'anacardos', 'fruto_seco', 553, 18.2, 30.2, 43.9, 5.9, 3.3, 7.78, 12),
    ('Pistachos', 'pistachos', 'fruto_seco', 560, 20.2, 27.2, 45.3, 7.7, 10.6, 5.91, 1),
    ('Avellanas', 'avellanas', 'fruto_seco', 628, 15.0, 16.7, 60.8, 4.3, 9.7, 4.46, 0),
    ('Semillas de chía', 'semillas de chia', 'fruto_seco', 486, 16.5, 42.1, 30.7, 0.0, 34.4, 3.33, 16),
    ('Pipas de girasol', 'pipas de girasol', 'fruto_seco', 584, 20.8, 20.0, 51.5, 2.6, 8.6, 4.46, 9),
    ('Crema de cacahuete', 'crema de cacahuete', 'fruto_seco', 588, 25.1, 19.6, 50.0, 9.2, 6.0, 10.30, 426),
    ('Aceite de oliva', 'aceite de oliva', 'aceite', 884, 0.0, 0.0, 100.0, 0.0, 0.0, 13.80, 2),
    ('Aceite de coco', 'aceite de coco', 'aceite', 862, 0.0, 0.0, 100.0, 0.0, 0.0, 82.50, 0),
    ('Aceitunas', 'aceitunas', 'aceite', 115, 0.8, 6.3, 10.7, 0.0, 3.2, 1.42, 735),

    -- Otros básicos
    ('Azúcar blanco', 'azucar blanco', 'otros', 387, 0.0, 100.0, 0.0, 100.0, 0.0, 0.00, 1),
    ('Miel', 'miel', 'otros', 304, 0.3, 82.4, 0.0, 82.1, 0.2, 0.00, 4),
    ('Chocolate negro 70%', 'chocolate negro 70%', 'otros', 598, 7.8, 45.9, 42.6, 24.0, 10.9, 24.50, 20),
    ('Cacao en polvo (sin azúcar)', 'cacao en polvo (sin azucar)', 'otros', 228, 19.6, 57.9, 13.7, 1.8, 33.2, 8.07, 21),
    ('Proteína de suero (whey, polvo)', 'proteina de suero (whey, polvo)', 'otros', 380, 76.0, 8.0, 6.0, 6.0, 0.0, 3.00, 200),
    ('Bebida de almendras (sin azúcar)', 'bebida de almendras (sin azucar)', 'otros', 13, 0.4, 0.3, 1.1, 0.2, 0.2, 0.10, 72),
    ('Bebida de avena', 'bebida de avena', 'otros', 45, 1.0, 7.5, 1.4, 4.0, 0.8, 0.20, 40);
