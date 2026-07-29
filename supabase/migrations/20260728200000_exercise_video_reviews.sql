-- =====================================================
-- TRAINER REVIEW OF CLIENT EXERCISE VIDEOS
-- =====================================================
-- El entrenador marca como "revisado" cada video que el cliente sube en una
-- serie y opcionalmente deja un comentario. El estado se guarda por URL de
-- video, NO por id de fila: `exercise_log_sets` se borra y se reinserta en
-- cada autosave del cliente, así que cualquier id de set es efímero. La URL
-- del video (Supabase storage) sí es estable.
--
-- Mismas convenciones que client_diet_pdfs: FK a tenant_host + RLS permisiva
-- (la autorización real vive en la capa de API, que valida la sesión del
-- entrenador y la propiedad del cliente).

-- El insert de la notificación de campana usa type = 'video_feedback', que no
-- existía en el enum. Va primero y en sentencia propia: Postgres permite
-- ADD VALUE dentro de una transacción siempre que el valor no se USE en esa
-- misma transacción (aquí no se usa, solo se declara).
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'video_feedback';

CREATE TABLE IF NOT EXISTS exercise_video_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL,
    video_url TEXT NOT NULL CHECK (video_url <> ''),
    -- Referencia informativa al log que contenía el video cuando se revisó.
    -- Deliberadamente SIN foreign key: los logs pueden borrarse/reescribirse y
    -- la revisión debe sobrevivir a eso (la clave real es video_url).
    exercise_log_id UUID,
    comment TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (client_id, video_url)
);

CREATE INDEX IF NOT EXISTS idx_exercise_video_reviews_client ON exercise_video_reviews (client_id);

DROP TRIGGER IF EXISTS update_exercise_video_reviews_updated_at ON exercise_video_reviews;
CREATE TRIGGER update_exercise_video_reviews_updated_at BEFORE UPDATE
    ON exercise_video_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE exercise_video_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon to manage exercise_video_reviews" ON exercise_video_reviews;
DROP POLICY IF EXISTS "Authenticated users can manage exercise_video_reviews" ON exercise_video_reviews;

CREATE POLICY "Allow anon to manage exercise_video_reviews" ON exercise_video_reviews
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage exercise_video_reviews" ON exercise_video_reviews
    TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE exercise_video_reviews IS 'Revisión del entrenador sobre un video subido por el cliente. Se indexa por (client_id, video_url) porque exercise_log_sets se reinserta en cada autosave y sus ids no son estables.';
COMMENT ON COLUMN exercise_video_reviews.exercise_log_id IS 'Solo referencia; sin FK a proposito para que la revisión sobreviva al borrado del log.';
