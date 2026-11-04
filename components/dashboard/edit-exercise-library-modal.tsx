"use client";

import type { Exercise } from "@/types/training";

import ExerciseLibraryFormModal from "./exercise-library-form-modal";

interface EditExerciseLibraryModalProps {
  isOpen: boolean;
  exercise: Exercise;
  onClose: () => void;
  onSuccess: () => void;
}

/** "Editar ejercicio": the shared form in edit mode. */
export default function EditExerciseLibraryModal(
  props: EditExerciseLibraryModalProps
) {
  return <ExerciseLibraryFormModal mode="edit" {...props} />;
}
