// Bloque de identidad del ejercicio justo debajo del hero: solo el
// nombre grande. La nota del entrenador la movimos a su propia card
// debajo de "Datos del programa" — ver TrainerNoteCard — para que las
// notas largas no rompan el layout aquí arriba.

interface Props {
  name: string;
}

export function ExerciseLogIdentity({ name }: Props) {
  return (
    <h2 className="text-2xl font-heading font-bold text-foreground leading-tight">
      {name}
    </h2>
  );
}
