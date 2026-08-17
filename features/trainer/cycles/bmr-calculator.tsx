"use client";

import type { ClientSex } from "./bmr";

import {
  Button,
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { basalMetabolicRate, isValidBmrInput } from "./bmr";

function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? isoDate
    : date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

interface BmrProfile {
  sex: ClientSex | null;
  height_cm: number | null;
  age: number | null;
  latest_weight_kg: number | null;
  latest_weight_date: string | null;
}

async function fetchBmrProfile(clientId: number): Promise<BmrProfile> {
  const response = await fetch(`/api/clients/${clientId}/bmr`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await response.json();

  if (response.ok === false || data?.success !== true) {
    throw new Error(data?.error ?? "No se pudo cargar el perfil");
  }

  return data.data as BmrProfile;
}

async function saveBmrProfile(
  clientId: number,
  patch: { sex?: ClientSex; height_cm?: number; weight_kg?: number }
): Promise<void> {
  const response = await fetch(`/api/clients/${clientId}/bmr`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await response.json();

  if (response.ok === false || data?.success !== true) {
    throw new Error(data?.error ?? "No se pudo guardar el perfil");
  }
}

interface BmrCalculatorProps {
  clientId: number;
  /** Current default-goals kcal, to mark the estimate as already applied. */
  currentKcal: number | null;
  /** Persisting the estimate into the default goals is in flight. */
  applying: boolean;
  onApply: (kcal: number) => void;
  /** Fires whenever the computed estimate changes (null = incomplete data). */
  onResultChange: (kcal: number | null) => void;
}

/**
 * Basal-calorie estimator (Mifflin-St Jeor) that sits directly under the
 * default-goals card and feeds it: the result can be applied as the goals'
 * kcal in one tap. Sex/height typed here can be saved back to the profile;
 * age derives from dob and weight from the latest check-in, so those two are
 * calculator-only overrides.
 */
export function BmrCalculator({
  clientId,
  currentKcal,
  applying,
  onApply,
  onResultChange,
}: BmrCalculatorProps) {
  const qc = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["bmr-profile", clientId],
    queryFn: () => fetchBmrProfile(clientId),
  });

  const [sex, setSex] = useState<ClientSex | "">("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const data = profileQuery.data;

    if (data !== undefined && seeded === false) {
      if (data.sex !== null) setSex(data.sex);
      if (data.age !== null) setAge(String(data.age));
      if (data.height_cm !== null) setHeight(String(data.height_cm));
      if (data.latest_weight_kg !== null)
        setWeight(String(data.latest_weight_kg));
      setSeeded(true);
    }
  }, [profileQuery.data, seeded]);

  const input = {
    sex: sex === "" ? null : sex,
    weightKg: Number(weight),
    heightCm: Number(height),
    ageYears: Number(age),
  };
  const bmr = isValidBmrInput(input) ? basalMetabolicRate(input) : null;

  useEffect(() => {
    onResultChange(bmr);
  }, [bmr, onResultChange]);

  // Values typed here that differ from what the profile/check-ins hold can
  // be saved back: sex/height to the clients row, weight as a new check-in
  // measurement (joining the weight-evolution history).
  const stored = profileQuery.data;
  const heightNumber = Number(height);
  const weightNumber = Number(weight);
  const heightValid =
    Number.isFinite(heightNumber) && heightNumber > 50 && heightNumber < 275;
  const weightValid =
    Number.isFinite(weightNumber) && weightNumber >= 25 && weightNumber <= 400;
  const profileDirty =
    stored !== undefined &&
    sex !== "" &&
    heightValid &&
    (sex !== stored.sex || heightNumber !== stored.height_cm);
  const weightDirty =
    stored !== undefined &&
    weightValid &&
    weightNumber !== stored.latest_weight_kg;
  const anyDirty = profileDirty || weightDirty;

  const saveProfile = useMutation({
    mutationFn: () => {
      const patch: {
        sex?: ClientSex;
        height_cm?: number;
        weight_kg?: number;
      } = {};

      if (profileDirty) {
        patch.sex = sex;
        patch.height_cm = heightNumber;
      }
      if (weightDirty) patch.weight_kg = weightNumber;

      return saveBmrProfile(clientId, patch);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["bmr-profile", clientId] }),
  });

  const applied = bmr !== null && currentKcal === bmr;

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="gap-4 p-5">
        <div className="flex items-center gap-2">
          <Icon
            className="text-emerald-600"
            icon="solar:calculator-linear"
            width={18}
          />
          <h3 className="text-sm font-semibold text-gray-900">
            Calculadora calórica
          </h3>
        </div>

        <p className="text-xs text-default-500">
          Basal estimado con los datos del cliente.
          {profileQuery.data?.latest_weight_date != null
            ? ` Peso del último registro (${formatShortDate(
                profileQuery.data.latest_weight_date
              )}).`
            : " Aún no hay peso registrado — escríbelo y guárdalo."}
        </p>

        {profileQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Select
                aria-label="Sexo"
                label="Sexo"
                selectedKeys={sex === "" ? [] : [sex]}
                variant="bordered"
                onSelectionChange={(keys) => {
                  const first =
                    keys === "all" ? undefined : Array.from(keys)[0];

                  setSex(first === "male" || first === "female" ? first : "");
                }}
              >
                <SelectItem key="male">Hombre</SelectItem>
                <SelectItem key="female">Mujer</SelectItem>
              </Select>
              <Input
                endContent={
                  <span className="text-xs text-default-400">años</span>
                }
                label="Edad"
                min={10}
                type="number"
                value={age}
                variant="bordered"
                onValueChange={setAge}
              />
              <Input
                endContent={
                  <span className="text-xs text-default-400">cm</span>
                }
                label="Altura"
                min={50}
                type="number"
                value={height}
                variant="bordered"
                onValueChange={setHeight}
              />
              <Input
                endContent={
                  <span className="text-xs text-default-400">kg</span>
                }
                label="Peso"
                min={25}
                type="number"
                value={weight}
                variant="bordered"
                onValueChange={setWeight}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-large border border-gray-200 bg-gray-50/60 px-4 py-3">
              <div className="flex flex-col">
                <span className="text-[11px] text-default-500">
                  Basal estimado
                </span>
                {bmr !== null ? (
                  <span className="text-2xl font-bold text-gray-900 tabular-nums">
                    {bmr.toLocaleString("es")}
                    <span className="ml-1 text-xs font-medium text-default-400">
                      kcal
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-default-400">
                    Completa los datos
                  </span>
                )}
              </div>

              {applied ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600">
                  <Icon icon="solar:check-circle-linear" width={16} />
                  En metas
                </span>
              ) : (
                <Button
                  className="shrink-0 bg-slate-900 text-white"
                  color="primary"
                  isDisabled={bmr === null}
                  isLoading={applying}
                  size="sm"
                  onPress={() => {
                    if (bmr !== null) onApply(bmr);
                  }}
                >
                  Usar en metas
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-default-400">
                Mifflin-St Jeor, sin factor de actividad — aplica tu método
                sobre esta base.
              </p>
              <div className="flex items-center gap-3">
                {anyDirty && (
                  <button
                    className="text-[11px] font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    disabled={saveProfile.isPending}
                    type="button"
                    onClick={() => saveProfile.mutate()}
                  >
                    {saveProfile.isPending
                      ? "Guardando..."
                      : "Guardar datos del cliente"}
                  </button>
                )}
                <Link
                  className="flex items-center gap-1 text-[11px] font-medium text-default-500 hover:text-gray-900"
                  href={`/trainer/dashboard/clients/${clientId}/charts`}
                >
                  <Icon icon="solar:graph-up-linear" width={13} />
                  Ver evolución del peso
                </Link>
              </div>
              {saveProfile.isError && (
                <span className="text-[11px] text-danger">
                  No se pudo guardar.
                </span>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
