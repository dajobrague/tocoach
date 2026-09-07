-- Client option selections: one per meal COMPONENT, not one per meal slot.
--
-- A slot groups its options by `group_index`: same group = alternatives
-- (choose one), different group = separate items that sum toward the meal.
-- The original UNIQUE (client_id, slot_id) allowed a single standing choice
-- per slot, so picking an alternative in one component evicted the pick in
-- every other component (they silently fell back to the first option).
--
-- An option is now simply selected or not: UNIQUE (client_id, option_id).
-- "One per component" is enforced at the app layer on write (the sibling
-- options of the same group are deselected before the new one is saved).
-- Existing rows already satisfy the new constraint (each client had at most
-- one row per slot, hence at most one per option).

ALTER TABLE meal_slot_option_selections
    DROP CONSTRAINT IF EXISTS meal_slot_option_selections_one_per_slot;

ALTER TABLE meal_slot_option_selections
    ADD CONSTRAINT meal_slot_option_selections_one_per_option
    UNIQUE (client_id, option_id);

COMMENT ON TABLE meal_slot_option_selections IS 'A client''s standing option choices. One row per selected option; at most one per (client, slot, group_index) — enforced on write.';
