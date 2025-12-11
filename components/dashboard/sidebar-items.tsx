import { type SidebarItem } from "./sidebar";

/**
 * Coaching platform dashboard sidebar items
 */
const dashboardSidebarItems: SidebarItem[] = [
  {
    key: "metricas",
    href: "/trainer/dashboard/metricas",
    icon: "solar:chart-line-duotone",
    title: "Métricas",
  },
  {
    key: "setup",
    href: "/trainer/dashboard/setup",
    icon: "solar:widget-2-outline",
    title: "Configuración de Plataforma",
  },
  {
    key: "clients",
    href: "/trainer/dashboard/clients",
    icon: "solar:users-group-rounded-linear",
    title: "Clientes",
  },
  {
    key: "inventory",
    href: "/trainer/dashboard/inventory",
    icon: "solar:box-linear",
    title: "Inventario de Suplementos",
  },
  {
    key: "templates",
    href: "/trainer/dashboard/templates",
    icon: "solar:folder-with-files-linear",
    title: "Plantillas de Programas",
  },
  {
    key: "exercise-library",
    href: "/trainer/dashboard/exercise-library",
    icon: "solar:dumbbell-linear",
    title: "Biblioteca de Ejercicios",
  },
  {
    key: "messaging",
    href: "/trainer/dashboard/messaging",
    icon: "solar:chat-round-dots-linear",
    title: "Mensajería",
  },
  // Note: Settings and Support are available in the user dropdown menu
];

export default dashboardSidebarItems;
