"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import InventoryContent from "@/components/dashboard/inventory-content";
import dashboardSidebarItems from "@/components/dashboard/sidebar-items";
import TopNavigation from "@/components/dashboard/top-navigation";

export default function InventoryPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Check authentication on client side
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.session) {
          router.push("/trainer/login");
        } else {
          setSession(data.session);
        }
      })
      .catch(() => {
        router.push("/trainer/login");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      router.push("/trainer/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleSectionChange = (key: string) => {
    const item = dashboardSidebarItems.find((item) => item.key === key);

    if (item?.href) {
      router.push(item.href);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation
        activeSection="inventory"
        items={dashboardSidebarItems}
        trainerEmail={session.email}
        trainerName={session.full_name || session.email}
        onLogout={handleLogout}
        onSelect={handleSectionChange}
      />

      {/* Main Content */}
      <main className="flex-1 w-full overflow-hidden">
        <InventoryContent />
      </main>
    </div>
  );
}
