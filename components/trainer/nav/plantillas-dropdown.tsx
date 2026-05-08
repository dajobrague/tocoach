"use client";

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";

import type { TrainerNavItem } from "@/features/trainer/nav/nav-items";

interface PlantillasDropdownProps {
  items: TrainerNavItem[];
  isActive: boolean;
}

export function PlantillasDropdown({
  items,
  isActive,
}: PlantillasDropdownProps) {
  const router = useRouter();

  return (
    <Dropdown placement="bottom-start">
      <DropdownTrigger>
        <Button
          className={`h-10 px-4 font-medium text-sm transition-colors ${
            isActive
              ? "bg-slate-100 text-black"
              : "text-gray-600 hover:text-black hover:bg-slate-50"
          }`}
          endContent={<Icon icon="solar:alt-arrow-down-linear" width={14} />}
          startContent={
            <Icon
              className={isActive ? "text-black" : "text-gray-500"}
              icon="solar:folder-with-files-linear"
              width={20}
            />
          }
          variant="light"
        >
          Plantillas
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Plantillas"
        classNames={{ base: "w-64" }}
        variant="flat"
        onAction={(key) => {
          const item = items.find((i) => i.key === key);
          if (item?.href) router.push(item.href);
        }}
      >
        {items.map((item) => (
          <DropdownItem
            key={item.key}
            startContent={
              <Icon
                className="text-gray-500"
                icon={item.icon}
                width={20}
              />
            }
          >
            {item.title}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
