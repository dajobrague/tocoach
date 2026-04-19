-- Migración 079: Toggle "ocultar calorías" en 2 niveles (plan + comida).
--
-- Contexto: feedback del trainer Carlos — necesita poder ocultar las
-- calorías al cliente, bien globalmente a nivel de plan, bien a nivel de una
-- comida concreta (p.ej. "esta cena no lleva kcal porque depende del
-- apetito").
--
-- Diseño:
--  - `nutrition_plans.show_calories`: BOOLEAN NOT NULL DEFAULT true.
--    Ningún plan existente cambia de comportamiento.
--  - `nutrition_meals.show_calories`: BOOLEAN NULL. Semántica:
--      NULL  → hereda del plan (comportamiento por defecto).
--      true  → muestra siempre, aunque el plan oculte.
--      false → oculta siempre, aunque el plan muestre.
--    Ningún meal existente cambia de comportamiento (todos quedan en NULL
--    = "hereda").
--
-- Aditiva, IF NOT EXISTS, no reescribe tablas, no toca datos.

ALTER TABLE nutrition_plans
  ADD COLUMN IF NOT EXISTS show_calories BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN nutrition_plans.show_calories IS
  'Whether calorie counts are shown to the client. Default true (backward compatible). Overridable per meal via nutrition_meals.show_calories.';

ALTER TABLE nutrition_meals
  ADD COLUMN IF NOT EXISTS show_calories BOOLEAN;

COMMENT ON COLUMN nutrition_meals.show_calories IS
  'Per-meal override for calorie visibility. NULL = inherit from nutrition_plans.show_calories. true/false = explicit override.';
