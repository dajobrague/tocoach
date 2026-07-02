"use client";

import { Button, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

type Variant = "light" | "solid" | "flat";
type Size = "sm" | "md";
type Placement = "top" | "top-end" | "bottom" | "bottom-end" | "left";

interface DeleteConfirmButtonProps {
  /** Runs only after the trainer confirms. */
  onConfirm: () => void;
  ariaLabel: string;
  /** Confirmation prompt shown in the popover. */
  message?: string;
  isDisabled?: boolean;
  size?: Size;
  variant?: Variant;
  className?: string;
  iconWidth?: number;
  placement?: Placement;
}

/**
 * A trash-icon button that requires an explicit confirm before firing, via a
 * small anchored popover ("¿Eliminar? [Cancelar] [Eliminar]"). Prevents
 * accidental one-click deletes without a jarring full-screen modal. Reused by
 * ingredient rows and media tiles.
 */
export function DeleteConfirmButton({
  onConfirm,
  ariaLabel,
  message = "¿Eliminar este elemento?",
  isDisabled = false,
  size = "sm",
  variant = "light",
  className,
  iconWidth = 18,
  placement = "top-end",
}: DeleteConfirmButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      showArrow
      isOpen={open}
      placement={placement}
      onOpenChange={setOpen}
    >
      <PopoverTrigger>
        <Button
          isIconOnly
          aria-label={ariaLabel}
          className={className}
          color="danger"
          isDisabled={isDisabled}
          size={size}
          variant={variant}
        >
          <Icon icon="solar:trash-bin-trash-linear" width={iconWidth} />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex max-w-[220px] flex-col gap-2 px-1 py-2">
          <p className="text-sm text-default-700">{message}</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="light" onPress={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-danger text-white"
              color="danger"
              size="sm"
              onPress={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
