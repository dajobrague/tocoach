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
import { useEffect, useState } from "react";

import { basalMetabolicRate, isValidBmrInput } from "./bmr";

interface BmrProfile {
  sex: ClientSex | null;
  height_cm: number | null;
  age: number | null;
  latest_weight_kg: number | null;
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
  patch: { sex?: ClientSex; height_cm?: number }
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

/**
 * Basal-calorie estimator for the goals tab (Jul 28 call): sex, age, height
 * and weight prefilled from the profile / latest check-in, result in big
 * integer kcal. Sex and height typed here can be saved back to the profile;
 * age derives from the birth date and weight from check-ins, so those two are
 * calculator-only overrides.
 */
export function BmrCalculator({ clientId }: { clientId: number }) {
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

  // Sex/height typed here that differ from the stored profile can be saved.
  const stored = profileQuery.data;
  const heightNumber = Number(height);
  const profileDirty =
    stored !== undefined &&
    sex !== "" &&
    Number.isFinite(heightNumber) &&
    heightNumber > 50 &&
    heightNumber < 275 &&
    (sex !== stored.sex || heightNumber !== stored.height_cm);

  const save = useMutation({
    mutationFn: () => {
      const patch: { sex?: ClientSex; height_cm?: number } = {};

      if (sex !== "") patch.sex = sex;
      if (Number.isFinite(heightNumber)) patch.height_cm = heightNumber;

      return saveBmrProfile(clientId, patch);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["bmr-profile", clientId] }),
  });

  return (
    <Card className="border border-gray-200 bg-white shadow-sm lg:col-span-3">
      <CardBody className="gap-4 p-5">
        <div className="flex items-center gap-2">
          <Icon
            className="text-default-500"
            icon="solar:calculator-linear"
            width={18}
          />
          <h3 className="text-sm font-semibold text-gray-900">
            Calculadora calórica
          </h3>
        </div>

        <p className="text-xs text-default-500">
          Metabolismo basal estimado (Mifflin-St Jeor) a partir de sexo, edad,
          altura y peso. Sin factor de actividad ni déficit/superávit — eso lo
          aplicas tú con tu propio método. El peso se precarga del último
          check-in del cliente.
        </p>

        {profileQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
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

            <div className="flex min-w-[13rem] flex-col items-center gap-1 rounded-large border border-emerald-100 bg-emerald-50/60 px-6 py-4">
              <span className="text-[11px] font-medium tracking-wide text-emerald-700 uppercase">
                Basal estimado
              </span>
              {bmr !== null ? (
                <span className="text-3xl font-bold text-gray-900 tabular-nums">
                  {bmr.toLocaleString("es")}
                  <span className="ml-1 text-sm font-medium text-default-500">
                    kcal
                  </span>
                </span>
              ) : (
                <span className="py-1.5 text-sm text-default-400">
                  Completa los datos
                </span>
              )}
            </div>
          </div>
        )}

        {profileDirty && (
          <div className="flex items-center gap-2">
            <Button
              isLoading={save.isPending}
              size="sm"
              startContent={
                save.isPending ? null : (
                  <Icon icon="solar:diskette-linear" width={15} />
                )
              }
              variant="bordered"
              onPress={() => save.mutate()}
            >
              Guardar sexo y altura en el perfil
            </Button>
            {save.isError && (
              <span className="text-xs text-danger">No se pudo guardar.</span>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
