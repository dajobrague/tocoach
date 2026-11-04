"use client";

import ExerciseLibraryFormModal from "./exercise-library-form-modal";

interface AddExerciseLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (exercise?: any) => void;
}

/** "Añadir ejercicio": the shared form in add mode. */
export default function AddExerciseLibraryModal(
  props: AddExerciseLibraryModalProps
) {
  return <ExerciseLibraryFormModal mode="add" {...props} />;
}
