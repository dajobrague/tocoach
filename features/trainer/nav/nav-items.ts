// features/trainer/nav/nav-items.ts
export type TrainerNavItem = {
  key: string;
  title: string;
  icon: string;
  href?: string;
  items?: TrainerNavItem[];
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
