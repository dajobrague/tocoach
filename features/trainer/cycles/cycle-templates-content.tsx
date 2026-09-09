"use client";

import { Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";

import { useCycleTemplates, useDeleteCycleTemplate } from "./use-cycles";

import { confirmAfterPress } from "@/lib/ui/native-dialog";

/**
 * Nutrition-v2 template library (`meal_cycle_templates`). Templates are only
 * created via "Guardar plantilla" on a client's meal plan and only consumed
 * via "Desde plantilla" in the new-plan modal, so this page is a read +
 * delete list — there is no v2 template editor to open.
 */
export function CycleTemplatesContent() {
  const { data: templates, isLoading, isError } = useCycleTemplates(true);
  const deleteM = useDeleteCycleTemplate();

  const handleDelete = (templateId: string) => {
    confirmAfterPress(
      "¿Eliminar esta plantilla? Los planes ya creados con ella no se ven afectados."
    ).then((confirmed) => {
      if (confirmed) deleteM.mutate(templateId);
    });
  };

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Planes nutricionales
        </h1>
        <p className="mt-1 text-default-500">
          Plantillas guardadas desde el plan de comidas de un cliente. Úsalas
          con «Desde plantilla» al crear un plan nuevo.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner color="primary" size="lg" />
        </div>
      ) : isError ? (
        <p className="py-20 text-center text-danger">
          No se pudieron cargar las plantillas.
        </p>
      ) : templates === undefined || templates.length === 0 ? (
        <div className="py-20 text-center">
          <Icon
            className="mx-auto mb-4 text-default-300"
            icon="solar:folder-with-files-linear"
            width={80}
          />
          <p className="mb-2 text-lg text-default-500">
            No tienes plantillas aún
          </p>
          <p className="text-default-400">
            Abre el plan de comidas de un cliente y pulsa «Guardar plantilla»
            para reutilizarlo con otros clientes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="transition-shadow hover:shadow-lg"
            >
              <CardBody className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-lg font-semibold text-foreground">
                    {template.name}
                  </h3>
                  <button
                    aria-label={`Eliminar plantilla ${template.name}`}
                    className="shrink-0 rounded p-1 text-default-300 hover:text-danger disabled:opacity-50"
                    disabled={deleteM.isPending}
                    type="button"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Icon icon="solar:trash-bin-trash-linear" width={18} />
                  </button>
                </div>
                <p className="flex items-center gap-2 text-sm text-default-600">
                  <Icon
                    className="text-default-400"
                    icon="solar:calendar-linear"
                    width={16}
                  />
                  {template.duration_days} días · {template.meals} comidas
                </p>
                <p className="border-t border-default-200 pt-3 text-xs text-default-400">
                  Creada:{" "}
                  {new Date(template.created_at).toLocaleDateString("es")}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
