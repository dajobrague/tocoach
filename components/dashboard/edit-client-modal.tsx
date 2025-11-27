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
import { Icon } from "@iconify/react";
import { useMemo, useState, useEffect } from "react";

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
        header: "border-b border-gray-200",
        footer: "border-t border-gray-200",
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
            <div className="bg-blue-50 p-2 rounded-lg">
              <Icon className="text-blue-600 text-xl" icon="solar:pen-bold" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Editar Cliente
              </h3>
              <p className="text-sm text-gray-500 font-normal">
                Actualiza la información del cliente
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-6">
            {/* Error de Submit */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {errors.submit}
              </div>
            )}

            {/* Información Personal */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
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
              </div>
            </div>

            {/* Información de Contacto */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
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
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
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
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
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
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
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
          <Button
            className="bg-blue-600 text-white"
            isLoading={isLoading}
            onPress={handleSubmit}
          >
            Guardar Cambios
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
