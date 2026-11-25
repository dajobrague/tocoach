// Secciones de gráficas (JC, nov): el entrenador agrupa las gráficas en
// pestañas ("Medidas", "Energía"…). La sección es un texto libre en cada
// gráfica; las pestañas salen en el orden en que aparecen en el documento.

export const GENERAL_SECTION = "General";

export function sectionOf(chart: { section?: string | undefined }): string {
  return chart.section?.trim() || GENERAL_SECTION;
}

/** Pestañas a mostrar; vacío si no hay nada que separar. */
export function chartSections(
  charts: ReadonlyArray<{ section?: string | undefined }>
): string[] {
  const names = [...new Set(charts.map(sectionOf))];

  return names.length === 1 && names[0] === GENERAL_SECTION ? [] : names;
}
