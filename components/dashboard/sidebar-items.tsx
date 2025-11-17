import { type SidebarItem } from "./sidebar";

/**
 * Coaching platform dashboard sidebar items
 */
const dashboardSidebarItems: SidebarItem[] = [
    {
        key: "analytics",
        href: "/trainer/dashboard/analytics",
        icon: "solar:chart-line-duotone",
        title: "Analytics",
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
        key: "messaging",
        href: "/trainer/dashboard/messaging",
        icon: "solar:chat-round-dots-linear",
        title: "Mensajería",
    },
    // Note: Settings and Support are available in the user dropdown menu
];

export default dashboardSidebarItems;
