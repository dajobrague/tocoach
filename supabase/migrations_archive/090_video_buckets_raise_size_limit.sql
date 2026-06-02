-- Migración 090: Subir el límite de los buckets de video a 1 GB.
--
-- Los buckets `exercise-videos` (065) y `client-exercise-videos` (076) se
-- crearon con `file_size_limit = NULL`, heredando el cap global del
-- proyecto. Hasta ahora el route handler limitaba a 100MB (`MAX_SIZE`),
-- pero estamos subiendo el cap del lado de la app a 1GB para permitir
-- subir prácticamente cualquier video desde un teléfono — la compresión
-- server-side (libx264 CRF 23, escalado a 1080p) reduce el tamaño final
-- almacenado.
--
-- Fijamos el límite explícito a 1 GB en cada bucket para que el bucket
-- coincida con el cap del handler y no dependa del default global del
-- proyecto (configurable desde el Dashboard, hoy invisible vía SQL).
-- Si el global del proyecto es menor, este UPDATE no lo sobreescribe;
-- habrá que subirlo desde Project Settings → Storage.

UPDATE storage.buckets
SET file_size_limit = 1073741824  -- 1 GB
WHERE id IN ('exercise-videos', 'client-exercise-videos')
  AND (file_size_limit IS NULL OR file_size_limit < 1073741824);
