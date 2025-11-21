"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  // Extract slug from pathname (e.g., /ironfit/dashboard -> ironfit)
  const slug = pathname.split("/")[1] || "";

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/client-logout", {
        method: "POST",
      });

      if (response.ok) {
        router.push(`/${slug}/login`);
        router.refresh();
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      className="w-full justify-start font-body"
      color="danger"
      disabled={isLoading}
      isLoading={isLoading}
      startContent={<Icon icon="solar:logout-bold" />}
      variant="flat"
      onClick={handleLogout}
    >
      Cerrar Sesión
    </Button>
  );
}
