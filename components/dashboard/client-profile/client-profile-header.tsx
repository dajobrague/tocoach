"use client";

import { Avatar, Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

import { MockClient } from "@/lib/mock-data/client-profile-mock";

interface ClientProfileHeaderProps {
  client: MockClient;
  onBack: () => void;
  onEdit?: () => void;
  onUpdateStatus?: () => void;
  onDelete?: () => void;
}

export default function ClientProfileHeader({
  client,
  onBack,
  onEdit,
  onUpdateStatus,
  onDelete,
}: ClientProfileHeaderProps) {
  const getStatusColor = (
    status: string
  ): "success" | "primary" | "warning" | "default" | "secondary" | "danger" => {
    switch (status) {
      case "Activo":
        return "success";
      case "Onboarding Completado":
        return "secondary";
      case "Programación Inicial Pendiente":
        return "warning";
      default:
        return "default";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleDateString("es-ES", {
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back button and Actions */}
        <div className="flex items-center justify-between mb-6">
          <Button
            className="text-gray-600 hover:text-gray-900"
            startContent={<Icon icon="solar:arrow-left-linear" width={20} />}
            variant="light"
            onPress={onBack}
          >
            Volver a Clientes
          </Button>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Edit Profile */}
            {onEdit && (
              <Button
                className="text-white font-semibold"
                color="primary"
                size="sm"
                startContent={<Icon icon="solar:pen-bold" width={18} />}
                variant="solid"
                onPress={onEdit}
              >
                Editar Perfil
              </Button>
            )}

            {/* Update Status Button */}
            {onUpdateStatus && (
              <Button
                className="text-blue-600 border-blue-600"
                color="primary"
                size="sm"
                startContent={<Icon icon="solar:refresh-bold" width={18} />}
                variant="bordered"
                onPress={onUpdateStatus}
              >
                Estado
              </Button>
            )}

            {/* Delete Button */}
            {onDelete && (
              <Button
                className="text-red-600 border-red-600"
                color="danger"
                size="sm"
                startContent={
                  <Icon icon="solar:trash-bin-trash-bold" width={18} />
                }
                variant="bordered"
                onPress={onDelete}
              >
                Eliminar
              </Button>
            )}
          </div>
        </div>

        {/* Client Info */}
        <div className="flex items-start gap-6">
          <Avatar
            {...(client.avatar ? { src: client.avatar } : {})}
            isBordered
            showFallback
            className="w-24 h-24"
            color="primary"
            name={client.name}
            radius="lg"
            size="lg"
          />
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">
                {client.name}
              </h1>
              <Chip
                color={getStatusColor(client.status)}
                size="sm"
                variant="flat"
              >
                {client.status}
              </Chip>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-1.5">
                <Icon icon="solar:letter-linear" width={16} />
                <span>{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center gap-1.5">
                  <Icon icon="solar:phone-linear" width={16} />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.location?.city && (
                <div className="flex items-center gap-1.5">
                  <Icon icon="solar:map-point-linear" width={16} />
                  <span>
                    {client.location.city}, {client.location.country}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Icon icon="solar:calendar-linear" width={16} />
                <span>Miembro desde {formatDate(client.joinedDate)}</span>
              </div>
            </div>

            {/* Quick Info */}
            <div className="flex flex-wrap gap-3">
              <div className="bg-gray-50 px-3 py-2 rounded-lg">
                <p className="text-xs text-gray-500">Edad</p>
                <p className="text-sm font-semibold text-gray-900">
                  {client.age} años
                </p>
              </div>
              <div className="bg-gray-50 px-3 py-2 rounded-lg">
                <p className="text-xs text-gray-500">Ocupación</p>
                <p className="text-sm font-semibold text-gray-900">
                  {client.occupation}
                </p>
              </div>
            </div>

            {/* Goals - Compact */}
            {client.goals && client.goals.length > 0 && (
              <div className="mt-3 flex items-start gap-2">
                <Icon
                  className="text-blue-600 mt-1 flex-shrink-0"
                  icon="solar:target-bold"
                  width={16}
                />
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">
                    Objetivos
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {client.goals.map((goal, index) => (
                      <span
                        key={index}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200"
                      >
                        {goal}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
