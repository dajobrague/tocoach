"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleLogout = async () => {
        setIsLoading(true);

        try {
            const response = await fetch("/api/auth/client-logout", {
                method: "POST",
            });

            if (response.ok) {
                router.push("/login");
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
            onClick={handleLogout}
            variant="flat"
            color="danger"
            startContent={<Icon icon="solar:logout-bold" />}
            className="w-full justify-start font-body"
            isLoading={isLoading}
            disabled={isLoading}
        >
            Cerrar Sesión
        </Button>
    );
}

