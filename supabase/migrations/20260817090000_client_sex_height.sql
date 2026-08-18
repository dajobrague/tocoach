-- Sex + height on clients, feeding the BMR calculator in the nutrition goals
-- tab (Jul 28 call). Both nullable: the calculator asks for missing values and
-- writes them back to the profile.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sex TEXT
    CHECK (sex IN ('male', 'female'));

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(4, 1)
    CHECK (height_cm > 50 AND height_cm < 275);

COMMENT ON COLUMN clients.sex IS 'Biological sex used for BMR estimation (male/female)';
COMMENT ON COLUMN clients.height_cm IS 'Height in centimeters used for BMR estimation';
