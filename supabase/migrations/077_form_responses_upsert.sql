-- Remove duplicate form_responses rows (keep the latest by id) before adding uniqueness
DELETE FROM form_responses a
USING form_responses b
WHERE a.id < b.id
  AND a.tenant_host = b.tenant_host
  AND a.client_id = b.client_id
  AND a.form_type = b.form_type
  AND a.response_date = b.response_date;

-- Prevent future duplicates and enable upsert
ALTER TABLE form_responses
ADD CONSTRAINT form_responses_unique_per_day
UNIQUE (tenant_host, client_id, form_type, response_date);
