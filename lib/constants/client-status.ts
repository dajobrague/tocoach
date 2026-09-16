/** Única fuente de verdad del estado de cliente: la UI (chip dropdown, modal
 *  de edición), el PATCH de estado y el alta usan esta lista.
 *
 *  Sep 2026: sólo Activo / Inactivo. El enum `client_status` de la BD conserva
 *  los valores antiguos (onboarding, pendientes de pago) porque Postgres no
 *  permite borrarlos; la migración 20260916120000 normaliza los datos. */

export type ClientStatusTone = "success" | "default";

export const CLIENT_STATUS_OPTIONS = ["Activo", "Inactivo"] as const;

export type ClientStatusOption = (typeof CLIENT_STATUS_OPTIONS)[number];

export const DEFAULT_CLIENT_STATUS: ClientStatusOption = "Activo";

export const isClientStatusOption = (
  value: unknown
): value is ClientStatusOption =>
  typeof value === "string" &&
  (CLIENT_STATUS_OPTIONS as readonly string[]).includes(value);

/** Cualquier valor heredado que no sea Activo se pinta neutro. */
export const clientStatusTone = (status: string): ClientStatusTone =>
  status === "Activo" ? "success" : "default";
