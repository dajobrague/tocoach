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

import { clientFetch } from "@/lib/auth/client-token-storage";
import {
  clearExerciseLogDraft,
  exerciseLogDraftStorageKey,
  readExerciseLogDraft,
  writeExerciseLogDraft,
  type ExerciseLogFormDraft,
  type SetDraft,
} from "@/lib/client/exercise-log-draft";
import {
  compressVideo,
  isCompressionSupported,
} from "@/lib/utils/video-compression";

interface ExerciseLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  exercise: {
    id: string;
    name: string;
    category?: string;
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

function isExerciseCardio(
  exercise: NonNullable<ExerciseLogModalProps["exercise"]>
) {
  return (
    exercise.category === "cardio" ||
    !!(exercise.duration || exercise.distance || exercise.cardioType)
  );
}

function defaultSet(): SetDraft {
  return { reps: "", weight: "" };
}

function buildBaseFormData(
  exercise: NonNullable<ExerciseLogModalProps["exercise"]>,
  existingLog: ExerciseLogModalProps["existingLog"]
): ExerciseLogFormDraft {
  let sets: SetDraft[];

  if (
    existingLog?.sets &&
    Array.isArray(existingLog.sets) &&
    existingLog.sets.length > 0
  ) {
    sets = existingLog.sets.map((s: any) => ({
      reps: s.reps != null ? String(s.reps) : "",
      weight: s.weight_kg != null ? String(s.weight_kg) : "",
    }));
  } else if (existingLog?.sets_completed) {
    const count = existingLog.sets_completed;
    const repsStr = existingLog.reps_completed;
    let reps = "";

    if (repsStr) {
      const m = String(repsStr).match(/\d+/);

      if (m) reps = m[0];
    }
    sets = Array.from({ length: count }, () => ({
      reps,
      weight: "",
    }));
  } else {
    const count = exercise.sets || 1;

    sets = Array.from({ length: count }, () => defaultSet());
  }

  return {
    sets,
    durationCompleted: existingLog
      ? existingLog.duration_minutes?.toString() ||
        exercise.duration?.toString() ||
        ""
      : exercise.duration?.toString() || "",
    distanceCompleted: existingLog
      ? existingLog.distance_km?.toString() ||
        exercise.distance?.toString() ||
        ""
      : exercise.distance?.toString() || "",
    intensityCompleted: existingLog
      ? existingLog.intensity || exercise.intensity || ""
      : exercise.intensity || "",
    avgHeartRate: existingLog?.avg_heart_rate?.toString() || "",
    notes: existingLog?.notes || "",
  };
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
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCardio = exercise ? isExerciseCardio(exercise) : false;

  const [formData, setFormData] = useState<ExerciseLogFormDraft>({
    sets: [defaultSet()],
    durationCompleted: "",
    distanceCompleted: "",
    intensityCompleted: "",
    avgHeartRate: "",
    notes: "",
  });

  const formDataRef = useRef(formData);

  formDataRef.current = formData;

  const draftKey = exerciseLogDraftStorageKey(
    clientId,
    sessionId,
    exerciseId,
    scheduledDate
  );

  useEffect(() => {
    if (!isOpen || !exercise) return;

    const base = buildBaseFormData(exercise, existingLog);
    const draftRead = readExerciseLogDraft(draftKey);

    let applyDraft = draftRead;

    if (draftRead && existingLog?.completed_at) {
      const serverMs = new Date(existingLog.completed_at as string).getTime();

      if (!Number.isNaN(serverMs) && serverMs > draftRead.updatedAt) {
        applyDraft = null;
      }
    }

    if (applyDraft) {
      setFormData({ ...base, ...applyDraft.formData });
    } else {
      setFormData(base);
    }

    setVideoUrl(existingLog?.video_url || null);
    setVideoPath(null);
  }, [
    isOpen,
    exercise,
    existingLog,
    clientId,
    sessionId,
    exerciseId,
    scheduledDate,
    draftKey,
  ]);

  useEffect(() => {
    if (!isOpen || !exercise) return;

    const t = window.setTimeout(() => {
      writeExerciseLogDraft(draftKey, formDataRef.current);
    }, 300);

    return () => window.clearTimeout(t);
  }, [formData, isOpen, exercise, draftKey]);

  useEffect(() => {
    if (!isOpen || !exercise) return;

    const persist = () => writeExerciseLogDraft(draftKey, formDataRef.current);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        persist();
      }
    };

    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isOpen, exercise, draftKey]);

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

  const updateSet = (index: number, field: keyof SetDraft, value: string) => {
    const newSets = [...formData.sets];

    newSets[index] = {
      reps: "",
      weight: "",
      ...newSets[index],
      [field]: value,
    };
    setFormData({ ...formData, sets: newSets });
  };

  const addSet = () => {
    const lastSet = formData.sets[formData.sets.length - 1];
    const newSet: SetDraft = lastSet
      ? { reps: lastSet.reps, weight: lastSet.weight }
      : defaultSet();

    setFormData({ ...formData, sets: [...formData.sets, newSet] });
  };

  const removeSet = (index: number) => {
    if (formData.sets.length <= 1) return;
    const newSets = formData.sets.filter((_, i) => i !== index);

    setFormData({ ...formData, sets: newSets });
  };

  const handleVideoUpload = async (file: File) => {
    try {
      let fileToUpload = file;

      if (isCompressionSupported()) {
        setIsCompressing(true);
        setCompressionProgress(0);
        fileToUpload = await compressVideo(file, (percent) => {
          setCompressionProgress(percent);
        });
        setIsCompressing(false);
      }

      setIsUploading(true);
      const fd = new FormData();

      fd.append("file", fileToUpload);

      const response = await clientFetch(
        `/api/clients/${clientId}/exercise-logs/upload-video`,
        { method: "POST", body: fd }
      );

      const data = await response.json();

      if (data.success) {
        setVideoUrl(data.url);
        setVideoPath(data.path);
      } else {
        alert("Error al subir video: " + (data.error || "Error desconocido"));
      }
    } catch (err) {
      console.error("[ExerciseLogModal] Error uploading video:", err);
      alert("Error al subir video");
      setIsCompressing(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (videoPath) {
      try {
        await clientFetch(
          `/api/clients/${clientId}/exercise-logs/upload-video?path=${encodeURIComponent(videoPath)}`,
          { method: "DELETE" }
        );
      } catch {
        // best effort
      }
    }
    setVideoUrl(null);
    setVideoPath(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const requestBody: any = {
        sessionId,
        exerciseId,
        scheduledDate,
        notes: formData.notes,
        videoUrl: videoUrl || null,
      };

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
        requestBody.sets = formData.sets.map((s) => ({
          reps: s.reps ? parseInt(s.reps) : null,
          weight: s.weight || null,
        }));
      }

      const response = await clientFetch(
        `/api/clients/${clientId}/exercise-logs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();

      if (data.success) {
        clearExerciseLogDraft(draftKey);
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
                <>
                  {/* Per-set inputs */}
                  <div className="space-y-3">
                    {formData.sets.map((set, index) => (
                      <div key={index} className="flex items-end gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mb-1">
                          {index + 1}
                        </div>
                        <Input
                          classNames={{ input: "text-base", base: "flex-1" }}
                          label={index === 0 ? "Reps" : undefined}
                          placeholder="10"
                          size="sm"
                          type="number"
                          value={set.reps}
                          onValueChange={(value) =>
                            updateSet(index, "reps", value)
                          }
                        />
                        <Input
                          classNames={{ input: "text-base", base: "flex-1" }}
                          label={index === 0 ? "Peso" : undefined}
                          placeholder="80kg"
                          size="sm"
                          value={set.weight}
                          onValueChange={(value) =>
                            updateSet(index, "weight", value)
                          }
                        />
                        {formData.sets.length > 1 && (
                          <Button
                            isIconOnly
                            className="mb-1"
                            size="sm"
                            variant="light"
                            onPress={() => removeSet(index)}
                          >
                            <Icon
                              className="text-danger"
                              icon="solar:trash-bin-minimalistic-bold"
                              width={16}
                            />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button
                    className="w-full"
                    size="sm"
                    startContent={
                      <Icon icon="solar:add-circle-bold" width={18} />
                    }
                    variant="flat"
                    onPress={addSet}
                  >
                    Añadir serie
                  </Button>

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

            {/* Video upload section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground font-heading">
                Video (Opcional)
              </h4>

              {videoUrl ? (
                <div className="relative rounded-lg overflow-hidden bg-black">
                  <video
                    controls
                    playsInline
                    className="w-full max-h-48 object-contain"
                    preload="metadata"
                    src={videoUrl}
                  />
                  <Button
                    isIconOnly
                    className="absolute top-2 right-2"
                    color="danger"
                    size="sm"
                    variant="solid"
                    onPress={handleRemoveVideo}
                  >
                    <Icon icon="solar:trash-bin-minimalistic-bold" width={16} />
                  </Button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.mov,.webm,.m4v"
                    className="hidden"
                    disabled={isCompressing || isUploading}
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];

                      if (file) handleVideoUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    className="w-full"
                    isDisabled={isCompressing || isUploading}
                    isLoading={isUploading && !isCompressing}
                    size="sm"
                    startContent={
                      !isUploading &&
                      !isCompressing && (
                        <Icon icon="solar:videocamera-bold" width={18} />
                      )
                    }
                    variant="flat"
                    onPress={() => fileInputRef.current?.click()}
                  >
                    {isCompressing
                      ? "Comprimiendo video..."
                      : isUploading
                        ? "Subiendo video..."
                        : "Subir video"}
                  </Button>
                  {isCompressing && (
                    <div>
                      <div className="flex items-center gap-2 text-sm text-foreground/60">
                        <Icon
                          className="animate-spin"
                          icon="solar:refresh-bold"
                          width={16}
                        />
                        Comprimiendo video... {compressionProgress}%
                      </div>
                      <div className="w-full bg-default-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${compressionProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
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
            isDisabled={isSaving || isUploading || isCompressing}
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
