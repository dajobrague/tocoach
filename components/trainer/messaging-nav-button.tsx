"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MESSAGING_PATH = "/trainer/dashboard/messaging";

/**
 * Icon-only shortcut to messaging, shown beside the notifications bell in
 * both trainer nav shells (the "Mensajería" menu entry was retired — same
 * icon, no label, always at hand).
 */
export function MessagingNavButton() {
  const pathname = usePathname();
  const active = pathname?.startsWith(MESSAGING_PATH) === true;

  return (
    <Button
      isIconOnly
      aria-label="Mensajería"
      as={Link}
      className={active ? "text-black" : "text-gray-600 hover:text-black"}
      href={MESSAGING_PATH}
      size="sm"
      variant="light"
    >
      <Icon className="text-2xl" icon="solar:chat-round-dots-linear" />
    </Button>
  );
}
