"use client";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ExerciseLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  exercise: {
    id: string;
    name: string;
    sets?: number;
    reps?: string;
    tempo?: string;
    rest?: string;
    trainingSystem?: string;
    duration?: number;
    distance?: number;
    intensity?: string;
    heartRateZone?: { min: number; max: number };
    cardioType?: string;
  } | null;
  sessionId: string;
  exerciseId: string;
  scheduledDate: string;
  clientId: string;
  existingLog?: any;
  onSuccess: () => void;
}

export function ExerciseLogModal({
  isOpen,
  onClose,
  exercise,
  sessionId,
  exerciseId,
  scheduledDate,
  clientId,
  existingLog,
  onSuccess,
}: ExerciseLogModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Detect if this is a cardio exercise
  const isCardio = !!(
    exercise?.duration ||
    exercise?.distance ||
    exercise?.cardioType
  );

  const [formData, setFormData] = useState({
    // Strength fields
    setsCompleted: exercise?.sets?.toString() || "",
    repsCompleted: exercise?.reps || "",
    weightUsed: "",
    // Cardio fields
    durationCompleted: exercise?.duration?.toString() || "",
    distanceCompleted: exercise?.distance?.toString() || "",
    intensityCompleted: exercise?.intensity || "",
    avgHeartRate: "",
    // Common
    notes: "",
  });

  // Update form data when exercise or existingLog changes
  useEffect(() => {
    if (exercise) {
      if (existingLog) {
        // Pre-fill with previously saved values
        setFormData({
          setsCompleted:
            existingLog.sets_completed?.toString() ||
            exercise?.sets?.toString() ||
            "",
          repsCompleted: existingLog.reps_completed || exercise?.reps || "",
          weightUsed: existingLog.weight_used || "",
          durationCompleted:
            existingLog.duration_minutes?.toString() ||
            exercise?.duration?.toString() ||
            "",
          distanceCompleted:
            existingLog.distance_km?.toString() ||
            exercise?.distance?.toString() ||
            "",
          intensityCompleted:
            existingLog.intensity || exercise?.intensity || "",
          avgHeartRate: existingLog.avg_heart_rate?.toString() || "",
          notes: existingLog.notes || "",
        });
      } else {
        setFormData({
          setsCompleted: exercise?.sets?.toString() || "",
          repsCompleted: exercise?.reps || "",
          weightUsed: "",
          durationCompleted: exercise?.duration?.toString() || "",
          distanceCompleted: exercise?.distance?.toString() || "",
          intensityCompleted: exercise?.intensity || "",
          avgHeartRate: "",
          notes: "",
        });
      }
    }
  }, [exercise, existingLog]);

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const scrollToFocused = useCallback(() => {
    requestAnimationFrame(() => {
      const el = document.activeElement as HTMLElement | null;

      if (el && bodyRef.current?.contains(el)) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const vv = window.visualViewport;

    if (!vv) return;

    const onResize = () => {
      const threshold = window.innerHeight * 0.75;
      const isKb = vv.height < threshold;

      setKeyboardOpen(isKb);
      if (isKb) {
        setTimeout(scrollToFocused, 120);
      }
    };

    vv.addEventListener("resize", onResize);

    return () => vv.removeEventListener("resize", onResize);
  }, [isOpen, scrollToFocused]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const requestBody: any = {
        sessionId,
        exerciseId,
        scheduledDate,
        notes: formData.notes,
      };

      // Add fields based on exercise type
      if (isCardio) {
        requestBody.durationCompleted = formData.durationCompleted
          ? parseInt(formData.durationCompleted)
          : null;
        requestBody.distanceCompleted = formData.distanceCompleted
          ? parseFloat(formData.distanceCompleted)
          : null;
        requestBody.intensityCompleted = formData.intensityCompleted || null;
        requestBody.avgHeartRate = formData.avgHeartRate
          ? parseInt(formData.avgHeartRate)
          : null;
      } else {
        requestBody.setsCompleted = parseInt(formData.setsCompleted);
        requestBody.repsCompleted = formData.repsCompleted;
        requestBody.weightUsed = formData.weightUsed;
      }

      const response = await fetch(`/api/clients/${clientId}/exercise-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
        onClose();
      } else {
        alert(
          "Error al guardar registro: " + (data.error || "Error desconocido")
        );
      }
    } catch (err) {
      console.error("[ExerciseLogModal] Error saving log:", err);
      alert("Error al guardar registro");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  if (!exercise) return null;

  return (
    <Modal
      classNames={{
        base: "max-h-[100vh] m-0",
        wrapper: "items-end sm:items-center",
        backdrop: "bg-black/80",
        header: "border-b border-default-200",
        footer: "border-t border-default-200",
        body: "py-6",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="full"
      onClose={handleClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div
              className={`${isCardio ? "bg-red-500" : "bg-primary"} p-2 rounded-lg`}
            >
              <Icon
                className="text-white text-xl"
                icon={
                  isCardio ? "solar:heart-pulse-bold" : "solar:dumbbell-bold"
                }
              />
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-foreground">
                {existingLog
                  ? isCardio
                    ? "Editar Cardio"
                    : "Editar Registro"
                  : isCardio
                    ? "Registrar Cardio"
                    : "Registrar Ejercicio"}
              </h3>
              <p className="text-sm text-foreground/60 font-body font-normal">
                {exercise.name}
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div
            ref={bodyRef}
            className={`flex flex-col gap-6 ${keyboardOpen ? "pb-[40vh]" : ""}`}
            onFocus={() => setTimeout(scrollToFocused, 200)}
          >
            {/* Exercise Details */}
            <div className="bg-default-50 p-4 rounded-lg space-y-2">
              <p className="text-xs text-foreground/60 font-body uppercase font-semibold">
                Datos del Programa
              </p>

              {isCardio ? (
                // Cardio exercise details
                <div className="grid grid-cols-2 gap-3">
                  {exercise.duration && (
                    <div>
                      <p className="text-xs text-foreground/60 font-body">
                        Duración
                      </p>
                      <p className="text-sm font-semibold text-foreground font-heading">
                        {exercise.duration} min
                      </p>
                    </div>
                  )}
                  {exercise.distance && (
                    <div>
                      <p className="text-xs text-foreground/60 font-body">
                        Distancia
                      </p>
                      <p className="text-sm font-semibold text-foreground font-heading">
                        {exercise.distance} km
                      </p>
                    </div>
                  )}
                  {exercise.intensity && (
                    <div>
                      <p className="text-xs text-foreground/60 font-body">
                        Intensidad
                      </p>
                      <p className="text-sm font-semibold text-foreground font-heading">
                        {exercise.intensity}
                      </p>
                    </div>
                  )}
                  {exercise.heartRateZone && (
                    <div>
                      <p className="text-xs text-foreground/60 font-body">
                        Zona FC
                      </p>
                      <p className="text-sm font-semibold text-foreground font-heading">
                        {exercise.heartRateZone.min}-
                        {exercise.heartRateZone.max} bpm
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // Strength exercise details
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-foreground/60 font-body">
                      Series
                    </p>
                    <p className="text-sm font-semibold text-foreground font-heading">
                      {exercise.sets} series
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground/60 font-body">
                      Repeticiones
                    </p>
                    <p className="text-sm font-semibold text-foreground font-heading">
                      {exercise.reps} reps
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground/60 font-body">
                      Sistema
                    </p>
                    <p className="text-sm font-semibold text-foreground font-heading">
                      {exercise.trainingSystem}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground/60 font-body">
                      Tempo
                    </p>
                    <p className="text-sm font-semibold text-foreground font-heading">
                      {exercise.tempo}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Log Form */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground font-heading">
                ¿Qué realizaste?
              </h4>

              {isCardio ? (
                // Cardio log form
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      classNames={{ input: "text-base" }}
                      label="Duración (min)"
                      placeholder="Ej: 30"
                      startContent={
                        <Icon
                          className="text-foreground/40"
                          icon="solar:clock-circle-bold"
                          width={18}
                        />
                      }
                      type="number"
                      value={formData.durationCompleted}
                      onValueChange={(value) =>
                        setFormData({ ...formData, durationCompleted: value })
                      }
                    />
                    <Input
                      classNames={{ input: "text-base" }}
                      label="Distancia (km)"
                      placeholder="Ej: 5.2"
                      startContent={
                        <Icon
                          className="text-foreground/40"
                          icon="solar:route-bold"
                          width={18}
                        />
                      }
                      step="0.1"
                      type="number"
                      value={formData.distanceCompleted}
                      onValueChange={(value) =>
                        setFormData({ ...formData, distanceCompleted: value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      classNames={{ value: "text-base" }}
                      label="Intensidad"
                      placeholder="Selecciona"
                      selectedKeys={
                        formData.intensityCompleted
                          ? [formData.intensityCompleted]
                          : []
                      }
                      startContent={
                        <Icon
                          className="text-foreground/40"
                          icon="solar:fire-bold"
                          width={18}
                        />
                      }
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;

                        setFormData({
                          ...formData,
                          intensityCompleted: selected,
                        });
                      }}
                    >
                      <SelectItem key="Baja">Baja</SelectItem>
                      <SelectItem key="Moderada">Moderada</SelectItem>
                      <SelectItem key="Alta">Alta</SelectItem>
                      <SelectItem key="Por Intervalos">
                        Por Intervalos
                      </SelectItem>
                    </Select>

                    <Input
                      classNames={{ input: "text-base" }}
                      label="FC Promedio (bpm)"
                      placeholder="Ej: 145"
                      startContent={
                        <Icon
                          className="text-foreground/40"
                          icon="solar:heart-pulse-bold"
                          width={18}
                        />
                      }
                      type="number"
                      value={formData.avgHeartRate}
                      onValueChange={(value) =>
                        setFormData({ ...formData, avgHeartRate: value })
                      }
                    />
                  </div>

                  <Textarea
                    classNames={{ input: "text-base" }}
                    label="Notas (Opcional)"
                    minRows={2}
                    placeholder="Ej: Me sentí muy bien, ritmo constante"
                    startContent={
                      <Icon
                        className="text-foreground/40"
                        icon="solar:notes-bold"
                        width={18}
                      />
                    }
                    value={formData.notes}
                    onValueChange={(value) =>
                      setFormData({ ...formData, notes: value })
                    }
                  />
                </>
              ) : (
                // Strength log form
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      isRequired
                      classNames={{ input: "text-base" }}
                      label="Series Completadas"
                      placeholder="Ej: 4"
                      startContent={
                        <Icon
                          className="text-foreground/40"
                          icon="solar:copy-bold"
                          width={18}
                        />
                      }
                      type="number"
                      value={formData.setsCompleted}
                      onValueChange={(value) =>
                        setFormData({ ...formData, setsCompleted: value })
                      }
                    />
                    <Input
                      isRequired
                      classNames={{ input: "text-base" }}
                      label="Repeticiones"
                      placeholder="Ej: 10 o 8-10"
                      startContent={
                        <Icon
                          className="text-foreground/40"
                          icon="solar:hashtag-bold"
                          width={18}
                        />
                      }
                      value={formData.repsCompleted}
                      onValueChange={(value) =>
                        setFormData({ ...formData, repsCompleted: value })
                      }
                    />
                  </div>

                  <Input
                    isRequired
                    classNames={{ input: "text-base" }}
                    label="Peso Utilizado"
                    placeholder="Ej: 20kg, BW, 15lbs, BW+10kg"
                    startContent={
                      <Icon
                        className="text-foreground/40"
                        icon="solar:scale-bold"
                        width={18}
                      />
                    }
                    value={formData.weightUsed}
                    onValueChange={(value) =>
                      setFormData({ ...formData, weightUsed: value })
                    }
                  />

                  <Textarea
                    classNames={{ input: "text-base" }}
                    label="Notas (Opcional)"
                    minRows={2}
                    placeholder="Ej: Me sentí fuerte, podría subir peso la próxima vez"
                    startContent={
                      <Icon
                        className="text-foreground/40"
                        icon="solar:notes-bold"
                        width={18}
                      />
                    }
                    value={formData.notes}
                    onValueChange={(value) =>
                      setFormData({ ...formData, notes: value })
                    }
                  />
                </>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={isSaving} variant="light" onPress={handleClose}>
            Cancelar
          </Button>
          <Button
            className="text-white font-semibold"
            color="primary"
            isDisabled={isSaving}
            isLoading={isSaving}
            startContent={
              !isSaving && <Icon icon="solar:check-circle-bold" width={18} />
            }
            onPress={handleSave}
          >
            {isSaving
              ? "Guardando..."
              : existingLog
                ? "Actualizar Registro"
                : "Guardar Registro"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
