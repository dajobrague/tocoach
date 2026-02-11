"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

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
    <>
      <Button
        className="w-full justify-start font-body"
        color="danger"
        startContent={
          <Icon className="text-lg" icon="solar:logout-2-bold-duotone" />
        }
        variant="flat"
        onPress={onOpen}
      >
        Cerrar Sesión
      </Button>

      <Modal isOpen={isOpen} placement="center" size="sm" onClose={onClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col items-center gap-2 pt-6 pb-2">
            <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
              <Icon
                className="text-danger text-3xl"
                icon="solar:logout-2-bold-duotone"
              />
            </div>
            <span className="font-heading text-lg">¿Cerrar sesión?</span>
          </ModalHeader>
          <ModalBody className="text-center px-6 pb-2">
            <p className="text-sm text-default-500 font-body">
              Tendrás que volver a ingresar tu contraseña para acceder a tu
              cuenta.
            </p>
          </ModalBody>
          <ModalFooter className="flex gap-2 px-6 pb-6 pt-2">
            <Button
              className="flex-1 font-body"
              variant="flat"
              onPress={onClose}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 font-body font-semibold"
              color="danger"
              isLoading={isLoading}
              onPress={handleLogout}
            >
              Cerrar Sesión
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
