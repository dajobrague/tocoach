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
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { clearClientToken } from "@/lib/auth/client-token-storage";
import { buildInitials, thumbnailUrl } from "@/lib/utils/avatar";

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
    const original = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = original;
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
      href: `/${slug}/suplementos`,
      icon: "solar:pill-bold",
      label: "Suplementos",
    },
    {
      href: `/${slug}/profile`,
      icon: "solar:user-bold",
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
              aria-modal="true"
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] overflow-hidden rounded-t-3xl border border-b-0 border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-content1"
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              exit={{ y: "100%" }}
              initial={{ y: "100%" }}
              role="dialog"
              style={{
                boxShadow:
                  "0 -8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.45)",
                paddingBottom:
                  "max(16px, calc(env(safe-area-inset-bottom) + 8px))",
              }}
              transition={{ damping: 30, stiffness: 260, type: "spring" }}
              onDragEnd={handleDragEnd}
            >
              <div className="flex justify-center pb-2 pt-3">
                <div className="h-1 w-10 rounded-full bg-default-300" />
              </div>

              <div className="flex items-center gap-4 px-6 pb-5 pt-2">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50">
                  {showAvatarImage ? (
                    <img
                      alt={fullName}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      sizes={`${HEADER_AVATAR_PX}px`}
                      src={thumbnailUrl(
                        clientProfilePicture,
                        HEADER_AVATAR_THUMB_PX
                      )}
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : (
                    <span
                      className="text-xl text-primary"
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 800,
                      }}
                    >
                      {initials}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-lg text-foreground"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 800,
                    }}
                  >
                    {fullName}
                  </p>
                  <p
                    className="truncate text-sm text-default-500"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {trainerName ? `Cliente · ${trainerName}` : "Cliente"}
                  </p>
                </div>
              </div>

              <div className="border-t border-default-200/50" />

              <nav
                aria-label="Más opciones"
                className="flex flex-col gap-1.5 px-3 py-3"
              >
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    className="flex h-14 items-center gap-4 rounded-xl px-3 transition-colors hover:bg-default-100/60 active:bg-default-200/60"
                    href={item.href}
                    onClick={onClose}
                  >
                    <Icon
                      className="shrink-0 text-2xl text-default-700"
                      icon={item.icon}
                    />
                    <span
                      className="flex-1 text-base text-foreground"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontWeight: 600,
                      }}
                    >
                      {item.label}
                    </span>
                    <Icon
                      className="shrink-0 text-lg text-default-300"
                      icon="solar:alt-arrow-right-linear"
                    />
                  </Link>
                ))}
              </nav>

              <div className="border-t border-default-200/50" />

              <div className="px-3 pb-2 pt-3">
                <button
                  className="flex h-14 w-full items-center gap-4 rounded-xl px-3 transition-colors hover:bg-danger/[0.08] active:bg-danger/[0.12]"
                  type="button"
                  onClick={openConfirm}
                >
                  <Icon
                    className="shrink-0 text-2xl text-danger"
                    icon="solar:logout-3-bold"
                  />
                  <span
                    className="flex-1 text-left text-base text-danger"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: 600,
                    }}
                  >
                    Cerrar sesión
                  </span>
                </button>
              </div>

              <div className="pb-3 pt-1 text-center">
                <p
                  className="text-xs text-default-400"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Top Coach · v1.0
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Modal
        isOpen={isConfirmOpen}
        placement="center"
        size="sm"
        onClose={closeConfirm}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col items-center gap-2 pb-2 pt-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
              <Icon
                className="text-3xl text-danger"
                icon="solar:logout-3-bold"
              />
            </div>
            <span className="font-heading text-lg">¿Cerrar sesión?</span>
          </ModalHeader>
          <ModalBody className="px-6 pb-2 text-center">
            <p className="font-body text-sm text-default-500">
              Tendrás que volver a ingresar tu contraseña para acceder a tu
              cuenta.
            </p>
          </ModalBody>
          <ModalFooter className="flex gap-2 px-6 pb-6 pt-2">
            <Button
              className="flex-1 font-body"
              variant="flat"
              onPress={closeConfirm}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 font-body font-semibold"
              color="danger"
              isLoading={isLoggingOut}
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
