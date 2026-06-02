-- UNIQUE constraint en scheduled_sessions(client_id, scheduled_date).
--
-- Precondiciones (verificadas en orden):
--   1. Migration 104 (upsert_scheduled_session RPC) aplicada y los 3
--      callers usándola — sin esto los duplicados volverían apenas
--      tengamos tráfico concurrente.
--   2. Migration 105 (dedupe) aplicada — sin esto la ALTER TABLE falla
--      con "could not create unique index".
--
-- Una vez aplicada, los INSERTs directos (legacy o paths que se nos
-- escapen) van a 23505 (unique_violation) en vez de crear duplicados
-- silenciosos. La RPC upsert_scheduled_session se mantiene como la
-- ruta canónica y atómica.

ALTER TABLE scheduled_sessions
  ADD CONSTRAINT scheduled_sessions_client_date_unique
  UNIQUE (client_id, scheduled_date);
