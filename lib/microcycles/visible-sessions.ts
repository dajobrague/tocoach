// Visibilidad de sesiones para el cliente: una sesión solo es visible si su
// programa dueño está ACTIVO para ese cliente. El editor de microciclo del
// trainer permite colocar sesiones de cualquier programa activo en el plan
// semanal del primario, así que un slot puede apuntar a una sesión cuyo
// programa fue pausado después — sin este filtro, "pausar" ocultaba el
// programa del picker pero sus sesiones seguían apareciendo como días
// planificados (queja Pablo Carboneras, ago 2026).

export function filterToActiveProgramSessions(
  sessionRows: Array<{ id: string; program_id: string | null }>,
  activeProgramIds: Iterable<string>
): Set<string> {
  const active = new Set(activeProgramIds);
  const visible = new Set<string>();

  for (const row of sessionRows) {
    if (row.program_id !== null && active.has(row.program_id)) {
      visible.add(row.id);
    }
  }

  return visible;
}
