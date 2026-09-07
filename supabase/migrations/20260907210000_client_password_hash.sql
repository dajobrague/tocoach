-- Contraseñas de cliente hasheadas (2026-09-07). Hasta hoy clients.password
-- guardaba la contraseña en claro y client-login la comparaba con `!==`.
-- Migración PROGRESIVA para que ningún cliente tenga que cambiar nada:
--   * nueva columna password_hash (scrypt, lib/security/password.ts);
--   * el login acepta hash o texto plano; si valida contra el texto plano,
--     guarda el hash y borra el texto plano en esa misma petición;
--   * setup / reset / cambio de contraseña escriben solo el hash.
-- clients.password se conserva hasta que cada cliente vuelva a entrar; una
-- vez todas las filas tengan password_hash y password NULL, se podrá dropear.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS password_hash TEXT;
COMMENT ON COLUMN public.clients.password_hash IS 'scrypt$N$r$p$salt$hash (lib/security/password.ts). Sustituye a password (texto plano, legado).';
COMMENT ON COLUMN public.clients.password IS 'LEGADO en texto plano: se vacía al primer login válido (ver password_hash).';
