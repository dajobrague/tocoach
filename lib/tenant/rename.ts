import type { SupabaseClient } from "@supabase/supabase-js";

import { clearTenantCache } from "@/lib/tenant/loader";

// Mensajes por SQLSTATE que lanza `rename_tenant` (migración 20260918120000).
const RENAME_ERRORS: Record<string, { status: number; error: string }> = {
  "23505": {
    status: 409,
    error: "Ese dominio ya está en uso por otro entrenador",
  },
  "22023": {
    status: 400,
    error:
      "Formato de dominio no válido. Usa solo letras, números y guiones (3-30 caracteres)",
  },
  P0002: {
    status: 404,
    error:
      "No encontramos tu plataforma actual. Vuelve a iniciar sesión e inténtalo de nuevo.",
  },
};

export type RenameTenantResult =
  | { ok: true; repointed: number }
  | { ok: false; status: number; error: string; cause: unknown };

/**
 * Renombra el slug/host de un tenant vía la función SQL `rename_tenant`.
 *
 * `tenants.host` es la PK y está copiada como FK en 40+ tablas hijas sin
 * ON UPDATE CASCADE, así que un UPDATE directo falla en cuanto el tenant tiene
 * datos. La función clona la fila, repuntea todas las hijas y borra la vieja
 * en una sola transacción. Aquí además se limpian las cachés de metadatos de
 * ambos slugs. La cookie del trainer (lleva `tenant_host`) la reemite la ruta
 * que llama, porque necesita la respuesta HTTP.
 */
export async function renameTenant(
  supabase: SupabaseClient<any, any, any>,
  from: string,
  to: string
): Promise<RenameTenantResult> {
  const { data, error } = await supabase.rpc("rename_tenant", {
    p_old_host: from,
    p_new_host: to,
  });

  if (error) {
    const mapped = RENAME_ERRORS[error.code ?? ""];

    return {
      ok: false,
      status: mapped?.status ?? 500,
      error: mapped?.error ?? "Error al actualizar el dominio",
      cause: error,
    };
  }

  clearTenantCache(from);
  clearTenantCache(to);

  const summary = data as { repointed?: number } | null;

  return { ok: true, repointed: summary?.repointed ?? 0 };
}
