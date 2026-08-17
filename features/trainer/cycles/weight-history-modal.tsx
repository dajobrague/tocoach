"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useState } from "react";

import { ChartCard } from "@/components/charts";
import { useClientSnapshot, type ChartRange } from "@/lib/charts/hooks";

const RANGES: { key: ChartRange; label: string }[] = [
  { key: "30d", label: "30 días" },
  { key: "90d", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "12m", label: "12 meses" },
];

/** Same aliases the analytics layer accepts for the weight question. */
const WEIGHT_QUESTION_IDS = new Set([
  "body_weight",
  "weight",
  "peso",
  "peso_corporal",
]);

interface WeightHistoryModalProps {
  clientId: number;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The client's weight-evolution chart in place: reuses the charts snapshot
 * pipeline (same data the charts page plots) inside a modal so the trainer
 * never leaves the goals tab. Content mounts only while open so the
 * snapshot fetch doesn't run in the background.
 */
export function WeightHistoryModal({
  clientId,
  isOpen,
  onClose,
}: WeightHistoryModalProps) {
  const [range, setRange] = useState<ChartRange>("90d");

  return (
    <Modal isOpen={isOpen} placement="center" size="2xl" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex flex-wrap items-center justify-between gap-3 pr-10">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Icon icon="solar:graph-up-linear" width={20} />
            </span>
            Evolución del peso
          </div>
          <div className="flex items-center gap-1 rounded-large bg-gray-100 p-1">
            {RANGES.map((option) => (
              <button
                key={option.key}
                className={
                  option.key === range
                    ? "rounded-medium bg-white px-2.5 py-1 text-xs font-medium text-gray-900 shadow-sm"
                    : "rounded-medium px-2.5 py-1 text-xs font-medium text-default-500 hover:text-gray-900"
                }
                type="button"
                onClick={() => setRange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </ModalHeader>
        <ModalBody className="pb-5">
          {isOpen && <WeightChart clientId={clientId} range={range} />}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function WeightChart({
  clientId,
  range,
}: {
  clientId: number;
  range: ChartRange;
}) {
  const { data, isLoading, isError } = useClientSnapshot(clientId, range);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner color="primary" size="sm" />
      </div>
    );
  }

  const chart = data?.effective_charts.charts.find(
    (config) =>
      config.source.kind === "form_question" &&
      WEIGHT_QUESTION_IDS.has(config.source.question_id)
  );

  if (isError || data === undefined || chart === undefined) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Icon
          className="text-default-300"
          icon="solar:chart-2-linear"
          width={30}
        />
        <p className="max-w-sm text-sm text-default-500">
          {isError
            ? "No se pudo cargar la gráfica de peso."
            : "Este cliente no tiene una gráfica de peso configurada."}
        </p>
        <Button
          as={Link}
          href={`/trainer/dashboard/clients/${clientId}/charts`}
          size="sm"
          variant="bordered"
        >
          Abrir sus gráficas
        </Button>
      </div>
    );
  }

  return (
    <ChartCard
      buckets={data.buckets[chart.id]?.buckets}
      config={chart}
      unit="kg"
    />
  );
}
