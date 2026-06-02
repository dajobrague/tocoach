-- Migración 089: Subir el límite de tamaño del bucket form-photos a 10MB.
--
-- El bucket se creó (062) con `file_size_limit = 5242880` (5MB). En
-- producción los iPhones suben fotos JPEG de progreso de 5-9MB
-- regularmente — el route handler aceptaba el archivo (validación
-- propia) pero el bucket lo rechazaba con "The object exceeded the
-- maximum allowed size", devolviendo un 500 al cliente y dejando la
-- foto sin subir.
--
-- Subimos a 10MB (10485760 bytes) — alineado con el cap del route
-- handler (`MAX_BYTES = 10 * 1024 * 1024`). HEIC live photos hasta de
-- 9MB pasan; archivos muy grandes (camera RAW, etc.) siguen
-- rechazándose en route con un mensaje claro antes de tocar storage.

UPDATE storage.buckets
SET file_size_limit = 10485760  -- 10 MB
WHERE id = 'form-photos'
  AND (file_size_limit IS NULL OR file_size_limit < 10485760);
