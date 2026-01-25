import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TopCoach Admin",
  description: "Panel de administración de TopCoach",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
