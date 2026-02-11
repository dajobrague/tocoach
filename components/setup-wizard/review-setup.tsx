"use client";

import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

import { useSetupWizard } from "@/lib/setup-wizard/context";

export default function ReviewSetup() {
  const { state, actions } = useSetupWizard();

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-heading font-bold text-black mb-2">
          Revisa tu Configuración
        </h2>
        <p className="text-gray-600 font-body">
          Verifica que todo esté correcto antes de finalizar
        </p>
      </div>

      {/* Domain Review */}
      <Card className="border border-gray-200">
        <CardBody className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-blue-50">
                <Icon
                  className="text-2xl text-blue-600"
                  icon="solar:global-linear"
                />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-black mb-1">
                  Dominio
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  Tu dirección web personalizada
                </p>
                <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
                  <p className="font-mono text-sm text-gray-800">
                    {state.domain.desired}
                  </p>
                </div>
              </div>
            </div>
            <Button
              className="bg-black text-white hover:bg-slate-800"
              size="sm"
              startContent={<Icon icon="solar:pen-linear" />}
              onPress={() => actions.setStep(1)}
            >
              Editar
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Colors Review */}
      <Card className="border border-gray-200">
        <CardBody className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-purple-50">
                <Icon
                  className="text-2xl text-purple-600"
                  icon="solar:palette-linear"
                />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-black mb-1">
                  Colores
                </h3>
                <p className="text-sm text-gray-600 mb-3">Tu paleta de marca</p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Brand Colors */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                      Marca
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm"
                          style={{ backgroundColor: state.colors.primary }}
                        />
                        <div>
                          <p className="text-xs text-gray-600">Primario</p>
                          <p className="text-xs font-mono text-gray-800">
                            {state.colors.primary}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm"
                          style={{ backgroundColor: state.colors.secondary }}
                        />
                        <div>
                          <p className="text-xs text-gray-600">Secundario</p>
                          <p className="text-xs font-mono text-gray-800">
                            {state.colors.secondary}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Button Colors */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                      Botones
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm"
                          style={{
                            backgroundColor: state.colors.buttons.primary.bg,
                          }}
                        />
                        <div>
                          <p className="text-xs text-gray-600">Primario</p>
                          <p className="text-xs font-mono text-gray-800">
                            {state.colors.buttons.primary.bg}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm"
                          style={{
                            backgroundColor: state.colors.buttons.secondary.bg,
                          }}
                        />
                        <div>
                          <p className="text-xs text-gray-600">Secundario</p>
                          <p className="text-xs font-mono text-gray-800">
                            {state.colors.buttons.secondary.bg}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <Button
              className="bg-black text-white hover:bg-slate-800"
              size="sm"
              startContent={<Icon icon="solar:pen-linear" />}
              onPress={() => actions.setStep(2)}
            >
              Editar
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Logo Review */}
      <Card className="border border-gray-200">
        <CardBody className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-green-50">
                <Icon
                  className="text-2xl text-green-600"
                  icon="solar:gallery-linear"
                />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-black mb-1">Logo</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Tu identidad visual
                </p>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {state.logo.url ? (
                    <div className="flex items-center gap-3">
                      <img
                        alt="Logo"
                        className={`${
                          state.logo.size === "small"
                            ? "h-8"
                            : state.logo.size === "large"
                              ? "h-16"
                              : "h-12"
                        } object-contain`}
                        src={state.logo.url}
                      />
                      <div>
                        <p className="text-xs text-gray-600">
                          Tamaño:{" "}
                          <span className="capitalize">{state.logo.size}</span>
                        </p>
                        <p className="text-xs text-gray-600">
                          Posición:{" "}
                          <span className="capitalize">
                            {state.logo.position}
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p
                        className="text-lg font-bold"
                        style={{ color: state.colors.primary }}
                      >
                        {state.logo.text || "MI MARCA"}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Texto - Tamaño: {state.logo.size}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Button
              className="bg-black text-white hover:bg-slate-800"
              size="sm"
              startContent={<Icon icon="solar:pen-linear" />}
              onPress={() => actions.setStep(3)}
            >
              Editar
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Typography Review */}
      <Card className="border border-gray-200">
        <CardBody className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-orange-50">
                <Icon
                  className="text-2xl text-orange-600"
                  icon="solar:text-field-linear"
                />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-black mb-1">
                  Tipografía
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Tus fuentes seleccionadas
                </p>

                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">
                      Fuente para Títulos
                    </p>
                    <p
                      className="text-xl font-bold"
                      style={{
                        fontFamily: `'${state.fonts.heading.family}', sans-serif`,
                      }}
                    >
                      {state.fonts.heading.family}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">
                      Fuente para Texto
                    </p>
                    <p
                      className="text-base"
                      style={{
                        fontFamily: `'${state.fonts.body.family}', sans-serif`,
                      }}
                    >
                      {state.fonts.body.family}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <Button
              className="bg-black text-white hover:bg-slate-800"
              size="sm"
              startContent={<Icon icon="solar:pen-linear" />}
              onPress={() => actions.setStep(4)}
            >
              Editar
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between pt-6 border-t border-gray-200">
        <Button
          className="border-gray-300"
          isDisabled={state.isLoading}
          startContent={<Icon icon="solar:arrow-left-linear" />}
          variant="bordered"
          onPress={actions.prevStep}
        >
          Anterior
        </Button>

        <Button
          className="px-8"
          color="success"
          endContent={<Icon icon="solar:check-circle-bold" />}
          isLoading={state.isLoading}
          size="lg"
          onPress={actions.saveConfiguration}
        >
          {state.isLoading ? "Guardando..." : "Guardar Configuración"}
        </Button>
      </div>

      {/* Error Display */}
      {state.errors.save && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <Icon className="text-xl" icon="solar:danger-circle-bold" />
            <p className="text-sm font-medium">{state.errors.save}</p>
          </div>
        </div>
      )}
    </div>
  );
}
