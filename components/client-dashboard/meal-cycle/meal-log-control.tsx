"use client";

import type { ClientMealLog } from "@/lib/nutrition/cycles/cycle-day";

import { Button, Spinner, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { MEAL_LOG_CHOICES } from "@/components/client-dashboard/meal-cycle/meal-log-options";
import {
  uploadMealLogPhoto,
  useLogMeal,
  type LogMealInput,
} from "@/lib/hooks/use-meal-log";

interface MealLogControlProps {
  slotId: string;
  /** Today's ISO date (the day being logged). */
  logDate: string;
  /** The existing log for this slot today, if any. */
  log: ClientMealLog | undefined;
  /** Option to attach when the client ate the plan (the selected/only option). */
  optionId: string | null;
}

/**
 * Per-meal quick log control (P5-T5), shown on today's meals. Three buttons —
 * ate the plan / ate something else / skipped — plus an optional photo and
 * comment. Each action POSTs to /api/client/meal-logs via {@link useLogMeal},
 * which upserts and optimistically updates the cached today view, so the meal
 * immediately shows (and can change) its logged state.
 */
export function MealLogControl({
  slotId,
  logDate,
  log,
  optionId,
}: MealLogControlProps) {
  const logMeal = useLogMeal();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [comment, setComment] = useState(log?.comment ?? "");
  const [isUploading, setIsUploading] = useState(false);

  const current = log?.status ?? null;

  function submit(
    patch: Partial<LogMealInput> & { status: LogMealInput["status"] }
  ) {
    const input: LogMealInput = {
      slotId,
      logDate,
      status: patch.status,
    };
    const trimmed = (patch.comment ?? comment).trim();
    const photoUrl = patch.photoUrl ?? log?.photoUrl ?? undefined;

    if (patch.status === "eaten_planned" && optionId !== null) {
      input.optionId = optionId;
    }
    if (trimmed.length > 0) input.comment = trimmed;
    if (photoUrl !== undefined && photoUrl !== null) input.photoUrl = photoUrl;

    logMeal.mutate(input);
  }

  async function onPickFile(file: File | undefined) {
    if (file === undefined || current === null) return;
    setIsUploading(true);
    try {
      const url = await uploadMealLogPhoto(file);

      submit({ status: current, photoUrl: url });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-2 border-t border-default-100 pt-3">
      <div className="flex flex-wrap gap-2" data-testid="meal-log-control">
        {MEAL_LOG_CHOICES.map((choice) => {
          const active = current === choice.status;

          return (
            <Button
              key={choice.status}
              className="flex-1"
              color={active ? choice.color : "default"}
              data-active={active}
              data-testid={`log-${choice.status}`}
              size="sm"
              startContent={<Icon icon={choice.icon} width={16} />}
              variant={active ? "solid" : "bordered"}
              onPress={() => submit({ status: choice.status })}
            >
              {choice.label}
            </Button>
          );
        })}
      </div>

      {current !== null ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              type="file"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
            <Button
              isDisabled={isUploading}
              size="sm"
              startContent={
                isUploading ? (
                  <Spinner size="sm" />
                ) : (
                  <Icon icon="solar:camera-linear" width={16} />
                )
              }
              variant="flat"
              onPress={() => fileInputRef.current?.click()}
            >
              {log?.photoUrl ? "Cambiar foto" : "Añadir foto"}
            </Button>
            {log?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="Foto de la comida"
                className="h-12 w-12 rounded-lg object-cover"
                src={log.photoUrl}
              />
            ) : null}
          </div>
          <Textarea
            data-testid="log-comment"
            maxRows={3}
            minRows={1}
            placeholder="Comentario (opcional)"
            size="sm"
            value={comment}
            onBlur={() => submit({ status: current })}
            onValueChange={setComment}
          />
        </div>
      ) : null}
    </div>
  );
}
