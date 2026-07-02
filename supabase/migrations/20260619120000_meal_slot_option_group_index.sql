-- Multi-component meals (trainer phase).
--
-- A meal slot can now hold several COMPONENTS that all count toward the meal
-- (e.g. sandwich + yogurt + coffee). Options sharing the same
-- (slot_id, group_index) are alternatives of one component (choose-one);
-- different group_index values are separate components that SUM.
--
-- Existing rows default to group_index = 0, so every current meal becomes a
-- single component with its options as alternatives — fully backward compatible
-- with the client app, which is updated in a later phase.

ALTER TABLE meal_slot_options
    ADD COLUMN IF NOT EXISTS group_index INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS meal_slot_options_slot_group_idx
    ON meal_slot_options (slot_id, group_index, position);
