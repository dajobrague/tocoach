"use client";

import type { ExerciseGroup } from "../progress/types";

import { Icon } from "@iconify/react";
import { useState } from "react";

import { isCardio } from "../progress/helpers";

import { ExerciseProgressCard } from "./exercise-progress-card";

interface Props {
  groups: ExerciseGroup[];
  variant: "strength" | "cardio";
  onPlayVideo: (url: string, name: string) => void;
}

export function OrphanExercisesSection({
  groups,
  variant,
  onPlayVideo,
}: Props) {
  const [sectionOpen, setSectionOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = groups.filter((g) =>
    variant === "cardio"
      ? isCardio(g.exercise.category)
      : !isCardio(g.exercise.category)
  );

  if (filtered.length === 0) return null;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });

  return (
    <section className="mt-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        aria-expanded={sectionOpen}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
        type="button"
        onClick={() => setSectionOpen((v) => !v)}
      >
        <div>
          <p className="font-semibold text-gray-900">
            Otros ejercicios registrados
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {filtered.length}{" "}
            {filtered.length === 1
              ? "ejercicio loggeado"
              : "ejercicios loggeados"}{" "}
            fuera del programa vigente
          </p>
        </div>
        <Icon
          className={`text-gray-400 transition-transform ${sectionOpen ? "rotate-180" : ""}`}
          icon="solar:alt-arrow-down-linear"
          width={18}
        />
      </button>
      {sectionOpen && (
        <div className="border-t border-gray-100 p-3 space-y-3 bg-gray-50">
          {filtered.map((g) => (
            <ExerciseProgressCard
              key={g.exercise.id}
              exerciseName={g.exercise.name}
              isExpanded={expanded.has(g.exercise.id)}
              logs={g.logs}
              prescribed={null}
              variant={variant}
              onPlayVideo={onPlayVideo}
              onToggle={() => toggle(g.exercise.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
