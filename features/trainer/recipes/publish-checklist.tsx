"use client";

import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

interface PublishChecklistProps {
  ready: boolean;
  isPublished: boolean;
  isPublishing: boolean;
  onPublish: () => void;
}

export function PublishChecklist({
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
            icon="solar:rocket-2-linear"
            width={18}
          />
          <h3 className="text-sm font-semibold text-gray-900">Publicación</h3>
        </div>

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
                Agrega un nombre y al menos un ingrediente para publicar.
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
