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
} from "@heroui/react";
import { useMemo, useState, useEffect } from "react";

import { IconTile } from "@/components/shared/icon-tile";

const countries = require("i18n-iso-countries");

countries.registerLocale(require("i18n-iso-countries/langs/es.json"));

interface EditClientModalProps {
  isOpen: boolean;
  clientId: string;
  clientData: {
    firstName: string;
    lastName: string;
    nickName?: string;
    email: string;
    phone?: string;
    occupation?: string;
    dob?: string;
    sex?: string;
    heightCm?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
    nationalId?: string;
    status?: string;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EditClientModal({
  isOpen,
  clientId,
  clientData,
  onClose,
  onSuccess,
}: EditClientModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    nickName: "",
    email: "",
    phone: "",
    occupation: "",
    dob: "",
    sex: "",
    heightCm: "",
    city: "",
    state: "",
    country: "",
    zip: "",
    nationalId: "",
    status: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when modal opens or clientData changes
  useEffect(() => {
    if (isOpen && clientData) {
      setFormData({
        firstName: clientData.firstName || "",
        lastName: clientData.lastName || "",
        nickName: clientData.nickName || "",
        email: clientData.email || "",
        phone: clientData.phone || "",
        occupation: clientData.occupation || "",
        dob: clientData.dob || "",
        sex: clientData.sex || "",
        heightCm: clientData.heightCm || "",
        city: clientData.city || "",
        state: clientData.state || "",
        country: clientData.country || "",
        zip: clientData.zip || "",
        nationalId: clientData.nationalId || "",
        status: clientData.status || "Activo",
      });
    }
  }, [isOpen, clientData]);

  // Obtener lista de países en español
  const countryList = useMemo(() => {
    const countryObj = countries.getNames("es", { select: "official" });

    return Object.entries(countryObj)
      .map(([code, name]) => ({ code, name: name as string }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "El nombre es requerido";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "El apellido es requerido";
    }
    if (!formData.email.trim()) {
      newErrors.email = "El email es requerido";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email inválido";
    }
    if (!formData.dob.trim()) {
      newErrors.dob = "La fecha de nacimiento es requerida";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Error al actualizar cliente");
      }

      // Success
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error("Error updating client:", error);
      setErrors({
        submit: "Error al actualizar el cliente. Por favor intente de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setErrors({});
      onClose();
    }
  };

  const statusOptions = [
    { value: "Activo", label: "Activo" },
    { value: "Onboarding Completado", label: "Onboarding Completado" },
    {
      value: "Programación Inicial Pendiente",
      label: "Programación Inicial Pendiente",
    },
    { value: "Inactivo", label: "Inactivo" },
  ];

  return (
    <Modal
      classNames={{
        base: "max-h-[90vh]",
        header: "border-b border-divider",
        footer: "border-t border-divider",
        body: "py-6",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="3xl"
      onClose={handleClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <IconTile icon="solar:pen-bold" />
            <div>
              <h3 className="font-heading text-xl font-bold text-foreground">
                Editar Cliente
              </h3>
              <p className="text-sm font-normal text-default-500">
                Actualiza la información del cliente
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-6">
            {/* Error de Submit */}
            {errors.submit && (
              <div className="rounded-large border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                {errors.submit}
              </div>
            )}

            {/* Información Personal */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-default-600">
                Información Personal
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  isRequired
                  errorMessage={errors.firstName}
                  isInvalid={!!errors.firstName}
                  label="Nombre"
                  placeholder="Ej: Juan"
                  value={formData.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                />
                <Input
                  isRequired
                  errorMessage={errors.lastName}
                  isInvalid={!!errors.lastName}
                  label="Apellido"
                  placeholder="Ej: Pérez"
                  value={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                />
                <Input
                  label="Apodo"
                  placeholder="Ej: Juanito"
                  value={formData.nickName}
                  onChange={(e) => handleChange("nickName", e.target.value)}
                />
                <Input
                  isRequired
                  errorMessage={errors.dob}
                  isInvalid={!!errors.dob}
                  label="Fecha de Nacimiento"
                  placeholder="YYYY-MM-DD"
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleChange("dob", e.target.value)}
                />
                <Select
                  label="Sexo"
                  placeholder="Selecciona"
                  selectedKeys={formData.sex ? [formData.sex] : []}
                  onChange={(e) => handleChange("sex", e.target.value)}
                >
                  <SelectItem key="male">Hombre</SelectItem>
                  <SelectItem key="female">Mujer</SelectItem>
                </Select>
                <Input
                  endContent={
                    <span className="text-xs text-default-400">cm</span>
                  }
                  label="Altura"
                  placeholder="Ej: 175"
                  type="number"
                  value={formData.heightCm}
                  onChange={(e) => handleChange("heightCm", e.target.value)}
                />
              </div>
            </div>

            {/* Información de Contacto */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-default-600">
                Información de Contacto
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  isRequired
                  errorMessage={errors.email}
                  isInvalid={!!errors.email}
                  label="Email"
                  placeholder="ejemplo@email.com"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
                <Input
                  label="Teléfono"
                  placeholder="+34 600 000 000"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
              </div>
            </div>

            {/* Información Adicional */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-default-600">
                Información Adicional
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Ocupación"
                  placeholder="Ej: Ingeniero"
                  value={formData.occupation}
                  onChange={(e) => handleChange("occupation", e.target.value)}
                />
                <Input
                  label="ID Nacional"
                  placeholder="Ej: DNI, Pasaporte"
                  value={formData.nationalId}
                  onChange={(e) => handleChange("nationalId", e.target.value)}
                />
              </div>
            </div>

            {/* Ubicación */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-default-600">
                Ubicación
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="País"
                  placeholder="Seleccionar país"
                  selectedKeys={formData.country ? [formData.country] : []}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;

                    handleChange("country", value || "");
                  }}
                >
                  {countryList.map((country) => (
                    <SelectItem key={country.name}>{country.name}</SelectItem>
                  ))}
                </Select>
                <Input
                  label="Estado/Provincia"
                  placeholder="Ej: Madrid"
                  value={formData.state}
                  onChange={(e) => handleChange("state", e.target.value)}
                />
                <Input
                  label="Ciudad"
                  placeholder="Ej: Madrid"
                  value={formData.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                />
                <Input
                  label="Código Postal"
                  placeholder="Ej: 28001"
                  value={formData.zip}
                  onChange={(e) => handleChange("zip", e.target.value)}
                />
              </div>
            </div>

            {/* Estado del Cliente */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-default-600">
                Estado del Cliente
              </h4>
              <Select
                isRequired
                label="Estado"
                placeholder="Seleccionar estado"
                selectedKeys={formData.status ? [formData.status] : []}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;

                  handleChange("status", value || "");
                }}
              >
                {statusOptions.map((option) => (
                  <SelectItem key={option.value}>{option.label}</SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="default" variant="light" onPress={handleClose}>
            Cancelar
          </Button>
          <Button color="primary" isLoading={isLoading} onPress={handleSubmit}>
            Guardar Cambios
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
