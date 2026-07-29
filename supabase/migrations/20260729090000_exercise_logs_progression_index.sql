-- Queries de progresión por ejercicio (rebanada Progreso + 1RM).
--
-- Los dos endpoints gemelos (/api/client/exercises/[id]/progression y
-- /api/clients/[clientId]/exercises/[id]/progression) y la detección de
-- récords en el POST de logs filtran siempre por el mismo trío:
-- client_id + exercise_id, ordenado por fecha descendente. Sin este índice
-- cada consulta escanea todos los exercise_logs del cliente.

CREATE INDEX IF NOT EXISTS idx_exercise_logs_client_exercise_completed
    ON exercise_logs (client_id, exercise_id, completed_at DESC);
