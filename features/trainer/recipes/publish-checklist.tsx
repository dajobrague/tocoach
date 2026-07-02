"use client";

import type { ChecklistItem } from "./recipe-macros";

import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

interface PublishChecklistProps {
  items: ChecklistItem[];
  ready: boolean;
  isPublished: boolean;
  isPublishing: boolean;
  onPublish: () => void;
}

export function PublishChecklist({
  items,
  ready,
  isPublished,
  isPublishing,
  onPublish,
}: PublishChecklistProps) {
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="gap-4 p-5">
        <div className="flex items-center gap-2">
          <Icon
            className="text-default-500"
            icon="solar:checklist-minimalistic-linear"
            width={18}
          />
          <h3 className="text-sm font-semibold text-gray-900">
            Checklist para publicar
          </h3>
        </div>

        <ul className="flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 text-sm">
              <Icon
                className={item.done ? "text-success-500" : "text-default-300"}
                icon={
                  item.done
                    ? "solar:check-circle-bold"
                    : "solar:close-circle-linear"
                }
                width={20}
              />
              <span
                className={item.done ? "text-gray-900" : "text-default-500"}
              >
                {item.label}
                {item.optional && (
                  <span className="ml-1 text-xs text-default-400">
                    (opcional)
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        {isPublished ? (
          <div className="flex items-center gap-2 rounded-large bg-success-50 px-3 py-2.5">
            <Icon
              className="text-success-600"
              icon="solar:verified-check-bold"
              width={20}
            />
            <span className="text-sm font-medium text-success-700">
              Receta publicada
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              className="w-full font-medium"
              color="success"
              isDisabled={ready === false}
              isLoading={isPublishing}
              startContent={
                isPublishing ? null : (
                  <Icon icon="solar:rocket-2-linear" width={18} />
                )
              }
              onPress={onPublish}
            >
              Publicar receta
            </Button>
            {ready === false && (
              <p className="text-xs text-default-500">
                Completa los pasos obligatorios para publicar.
              </p>
            )}
            {ready && (
              <Chip
                className="self-start"
                color="success"
                size="sm"
                variant="flat"
              >
                Lista para publicar
              </Chip>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
