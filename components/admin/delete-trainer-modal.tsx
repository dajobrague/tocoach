"use client";

import { Icon } from "@iconify/react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import React from "react";

interface DeletionImpact {
  clients_count: number;
  programs_count: number;
  sessions_count: number;
  exercises_count: number;
  nutrition_plans_count: number;
  messages_count: number;
  tenants_count: number;
}

interface DeleteTrainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  trainerId: string;
  trainerName: string;
}

export default function DeleteTrainerModal({
  isOpen,
  onClose,
  onSuccess,
  trainerId,
  trainerName,
}: DeleteTrainerModalProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [impact, setImpact] = React.useState<DeletionImpact | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (isOpen && trainerId) {
      fetchDeletionImpact();
    }
  }, [isOpen, trainerId]);

  const fetchDeletionImpact = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/trainers/${trainerId}/deletion-impact`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));

        console.error("Deletion impact fetch error:", errorData);
        throw new Error(errorData.error || "Error fetching deletion impact");
      }

      const data = await response.json();

      console.log("Deletion impact data:", data);
      setImpact(data.impact);
    } catch (err) {
      setError("Error al obtener información de eliminación");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/trainers/${trainerId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();

        throw new Error(data.error || "Error al eliminar entrenador");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al eliminar entrenador"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setImpact(null);
    setError("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} size="2xl" onClose={handleClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Icon
              className="text-2xl text-danger"
              icon="solar:danger-triangle-bold-duotone"
            />
            <h2 className="text-xl font-heading font-bold">
              Eliminar Entrenador Permanentemente
            </h2>
          </div>
        </ModalHeader>

        <ModalBody>
          {error && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Icon className="text-danger" icon="solar:danger-circle-bold" />
                <p className="text-danger text-sm font-body">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <p className="text-slate-700 font-body">
              ¿Estás seguro que deseas eliminar permanentemente a{" "}
              <strong>{trainerName}</strong>?
            </p>

            {isLoading ? (
              <div className="flex justify-center py-4">
                <Spinner size="lg" />
              </div>
            ) : impact ? (
              <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                <p className="text-danger-900 font-semibold font-body mb-3">
                  ⚠️ Esta acción eliminará PERMANENTEMENTE:
                </p>
                <ul className="space-y-2 text-sm text-danger-800 font-body">
                  <li className="flex items-center gap-2">
                    <Icon
                      className="text-lg"
                      icon="solar:users-group-rounded-bold"
                    />
                    <span>
                      <strong>{impact.clients_count}</strong> cliente(s)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon className="text-lg" icon="solar:document-bold" />
                    <span>
                      <strong>{impact.programs_count}</strong> programa(s)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon className="text-lg" icon="solar:calendar-bold" />
                    <span>
                      <strong>{impact.sessions_count}</strong> sesión(es)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon className="text-lg" icon="solar:dumbbell-bold" />
                    <span>
                      <strong>{impact.exercises_count}</strong> ejercicio(s)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon className="text-lg" icon="solar:leaf-bold" />
                    <span>
                      <strong>{impact.nutrition_plans_count}</strong> plan(es)
                      de nutrición
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon className="text-lg" icon="solar:chat-round-bold" />
                    <span>
                      <strong>{impact.messages_count}</strong> mensaje(s)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon className="text-lg" icon="solar:global-bold" />
                    <span>
                      <strong>{impact.tenants_count}</strong> tenant(s)
                      (subdominios)
                    </span>
                  </li>
                </ul>
                <p className="text-xs text-danger-700 mt-2 italic">
                  * La cuenta de autenticación quedará huérfana pero inactiva
                </p>
              </div>
            ) : null}

            <div className="bg-slate-100 border border-slate-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Icon
                  className="text-slate-700 text-xl mt-0.5"
                  icon="solar:info-circle-bold"
                />
                <div className="text-sm font-body text-slate-700">
                  <p className="font-semibold mb-2">Importante:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      Esta acción es <strong>IRREVERSIBLE</strong>
                    </li>
                    <li>Todos los datos relacionados serán eliminados</li>
                    <li>Los clientes perderán acceso inmediatamente</li>
                    <li>El subdominio del entrenador será liberado</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            color="default"
            disabled={isDeleting}
            variant="light"
            onPress={handleClose}
          >
            Cancelar
          </Button>
          <Button
            className="font-semibold"
            color="danger"
            disabled={isLoading || isDeleting}
            isLoading={isDeleting}
            onPress={handleDelete}
          >
            {isDeleting ? "Eliminando..." : "Sí, Eliminar Todo Permanentemente"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
