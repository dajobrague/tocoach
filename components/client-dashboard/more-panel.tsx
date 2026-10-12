"use client";

import {
  Button,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useClientData } from "@/components/client-dashboard/client-data-provider";
import {
  ClientSheet,
  ClientSheetGrabber,
} from "@/components/client-dashboard/client-sheet";
import { IconTile } from "@/components/shared/icon-tile";
import { clearClientToken } from "@/lib/auth/client-token-storage";
import { buildInitials, thumbnailUrl } from "@/lib/utils/avatar";
import { lockBodyScroll } from "@/lib/ui/scroll-lock";

interface MorePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHEET_DISMISS_OFFSET_PX = 100;
const SHEET_DISMISS_VELOCITY = 800;
const HEADER_AVATAR_PX = 64;
const HEADER_AVATAR_THUMB_PX = 128;

export function MorePanel({ isOpen, onClose }: MorePanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { clientProfilePicture, firstName, lastName, trainerName } =
    useClientData();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const {
    isOpen: isConfirmOpen,
    onClose: closeConfirm,
    onOpen: openConfirm,
  } = useDisclosure();

  const slug = pathname.split("/")[1] || "";
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim() || "Cliente";
  const initials = buildInitials(firstName, lastName);
  const showAvatarImage = Boolean(clientProfilePicture) && !avatarFailed;

  // Reset broken-image flag if the picture URL changes.
  useEffect(() => {
    setAvatarFailed(false);
  }, [clientProfilePicture]);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!isOpen) return undefined;
    const unlock = lockBodyScroll();

    return () => {
      unlock();
    };
  }, [isOpen]);

  // Close on Escape key.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Calendario is temporarily hidden from the menu for this release.
  // The /calendar page itself remains intact — re-add the entry below
  // when ready to ship.
  const navItems = [
    {
      href: `/${slug}/programs`,
      icon: "solar:dumbbell-linear",
      label: "Programas",
    },
    {
      href: `/${slug}/suplementos`,
      icon: "solar:pill-linear",
      label: "Suplementos",
    },
    {
      href: `/${slug}/profile`,
      icon: "solar:user-linear",
      label: "Mi perfil",
    },
  ];

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (
      info.offset.y > SHEET_DISMISS_OFFSET_PX ||
      info.velocity.y > SHEET_DISMISS_VELOCITY
    ) {
      onClose();
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/client-logout", {
        method: "POST",
      });

      // Always clear the localStorage fallback token, even on server error,
      // so a stale JWT can't keep authenticating writes for 30 days.
      clearClientToken();

      if (response.ok) {
        closeConfirm();
        onClose();
        router.push(`/${slug}/login`);
        router.refresh();
      }
    } catch (error) {
      console.error("Logout error:", error);
      clearClientToken();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="more-panel-scrim"
              aria-hidden
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 bg-black/30"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
            />

            <motion.div
              key="more-panel-sheet"
              animate={{ y: 0 }}
              aria-label="Más opciones"
              aria-modal="true"
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] overflow-hidden rounded-t-[24px] bg-background pb-[max(16px,calc(env(safe-area-inset-bottom)+8px))] shadow-large"
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              exit={{ y: "100%" }}
              initial={{ y: "100%" }}
              role="dialog"
              transition={{ damping: 30, stiffness: 260, type: "spring" }}
              onDragEnd={handleDragEnd}
            >
              <div className="flex h-6 items-center justify-center">
                <span className="h-[5px] w-9 rounded-full bg-default-300" />
              </div>

              <div className="flex flex-col gap-4 px-4 pb-2">
                <div className="flex flex-col items-center px-2 pb-2 pt-1 text-center">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                    {showAvatarImage ? (
                      <img
                        alt={fullName}
                        className="h-full w-full object-cover"
                        decoding="async"
                        loading="lazy"
                        sizes={`${HEADER_AVATAR_PX}px`}
                        src={thumbnailUrl(
                          clientProfilePicture,
                          HEADER_AVATAR_THUMB_PX
                        )}
                        onError={() => setAvatarFailed(true)}
                      />
                    ) : (
                      <span className="font-heading text-[22px] font-extrabold text-primary">
                        {initials}
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 max-w-full truncate font-heading text-[22px] text-foreground">
                    {fullName}
                  </p>
                  <p className="max-w-full truncate text-sm text-default-500">
                    {trainerName ? `Cliente · ${trainerName}` : "Cliente"}
                  </p>
                </div>

                <nav
                  aria-label="Más opciones"
                  className="divide-y divide-default-100 overflow-hidden rounded-large bg-content1 shadow-small"
                >
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors active:bg-default-100 [@media(hover:hover)]:hover:bg-default-50"
                      href={item.href}
                      onClick={onClose}
                    >
                      <IconTile icon={item.icon} size="sm" />
                      <span className="flex-1 text-[15px] font-semibold text-foreground">
                        {item.label}
                      </span>
                      <Icon
                        className="shrink-0 text-lg text-default-400"
                        icon="solar:alt-arrow-right-linear"
                      />
                    </Link>
                  ))}
                </nav>

                <div className="overflow-hidden rounded-large bg-content1 shadow-small">
                  <button
                    className="flex min-h-14 w-full items-center justify-center gap-2 px-4 text-base font-semibold text-danger transition-colors active:bg-danger/10 [@media(hover:hover)]:hover:bg-danger/5"
                    type="button"
                    onClick={openConfirm}
                  >
                    <Icon icon="solar:logout-2-linear" width={20} />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ClientSheet isOpen={isConfirmOpen} size="sm" onClose={closeConfirm}>
        <ModalContent>
          {(onCloseSheet) => (
            <>
              <ClientSheetGrabber onClose={onCloseSheet} />
              <ModalHeader className="flex flex-col items-center gap-2 pb-2 pt-2 sm:pt-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
                  <Icon
                    className="text-3xl text-danger"
                    icon="solar:logout-3-bold"
                  />
                </div>
                <span className="font-heading text-lg">¿Cerrar sesión?</span>
              </ModalHeader>
              <ModalBody className="px-6 pb-2 text-center">
                <p className="text-sm text-default-500">
                  Tendrás que volver a ingresar tu contraseña para acceder a tu
                  cuenta.
                </p>
              </ModalBody>
              <ModalFooter className="flex gap-2 px-6 pb-6 pt-2">
                <Button
                  className="flex-1"
                  variant="flat"
                  onPress={closeConfirm}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 font-semibold"
                  color="danger"
                  isLoading={isLoggingOut}
                  onPress={handleLogout}
                >
                  Cerrar sesión
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </ClientSheet>
    </>
  );
}
