// features/trainer/nav/nav-items.ts
export type TrainerNavItem = {
  key: string;
  title: string;
  icon: string;
  href?: string;
  items?: TrainerNavItem[];
  /** Only show when the tenant's nutrition_v2 flag is enabled. */
  requiresNutritionV2?: boolean;
};

export type TrainerNavSection = {
  key: string;
  title: string;
  items: TrainerNavItem[];
};

export const TRAINER_NAV: TrainerNavSection[] = [
  {
    key: "principal",
    title: "Principal",
    items: [
      {
        key: "metricas",
        title: "Métricas",
        icon: "solar:chart-line-duotone",
        href: "/trainer/dashboard/metricas",
      },
      {
        key: "clients",
        title: "Clientes",
        icon: "solar:users-group-rounded-linear",
        href: "/trainer/dashboard/clients",
      },
      {
        key: "messaging",
        title: "Mensajería",
        icon: "solar:chat-round-dots-linear",
        href: "/trainer/dashboard/messaging",
      },
    ],
  },
  {
    key: "bibliotecas",
    title: "Bibliotecas",
    items: [
      {
        key: "exercise-library",
        title: "Ejercicios",
        icon: "solar:dumbbell-linear",
        href: "/trainer/dashboard/exercise-library",
      },
      {
        key: "inventory",
        title: "Suplementos",
        icon: "solar:box-linear",
        href: "/trainer/dashboard/inventory",
      },
      {
        key: "recipes",
        title: "Recetas",
        icon: "solar:chef-hat-linear",
        href: "/trainer/dashboard/recipes",
        requiresNutritionV2: true,
      },
    ],
  },
  {
    key: "plantillas",
    title: "Plantillas",
    items: [
      {
        key: "templates-group",
        title: "Plantillas",
        icon: "solar:folder-with-files-linear",
        items: [
          {
            key: "templates-programs",
            title: "Programas",
            icon: "solar:document-add-linear",
            href: "/trainer/dashboard/templates",
          },
          {
            key: "templates-charts",
            title: "Gráficas",
            icon: "solar:chart-square-linear",
            href: "/trainer/dashboard/charts-template",
          },
          {
            key: "templates-checkin",
            title: "Check-in",
            icon: "solar:calendar-mark-linear",
            href: "/trainer/settings/forms/checkins",
          },
          {
            key: "templates-habits",
            title: "Hábitos diarios",
            icon: "solar:notebook-linear",
            href: "/trainer/settings/forms/habits",
          },
        ],
      },
    ],
  },
];

/**
 * Remove flag-gated items the tenant can't see. Pure; drives both nav shells
 * and is unit-tested. Currently only the nutrition_v2 gate.
 */
export function filterTrainerNav(
  sections: TrainerNavSection[],
  flags: { nutritionV2: boolean }
): TrainerNavSection[] {
  const keepItem = (item: TrainerNavItem): TrainerNavItem | null => {
    if (item.requiresNutritionV2 === true && flags.nutritionV2 === false) {
      return null;
    }

    if (item.items !== undefined) {
      const kept = item.items
        .map(keepItem)
        .filter((child): child is TrainerNavItem => child !== null);

      return { ...item, items: kept };
    }

    return item;
  };

  return sections.map((section) => ({
    ...section,
    items: section.items
      .map(keepItem)
      .filter((item): item is TrainerNavItem => item !== null),
  }));
}

/** Flatten leaf items (those with `href`) for active-key matching. */
export function flattenLeaves(
  sections: TrainerNavSection[] = TRAINER_NAV
): TrainerNavItem[] {
  const out: TrainerNavItem[] = [];
  const walk = (item: TrainerNavItem) => {
    if (item.href) out.push(item);
    item.items?.forEach(walk);
  };

  sections.forEach((s) => s.items.forEach(walk));

  return out;
}
