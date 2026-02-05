"use client";

import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import countries from "i18n-iso-countries";
import es from "i18n-iso-countries/langs/es.json";
import { useMemo, useState } from "react";

// Registrar el idioma español
countries.registerLocale(es);

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddClientModal({
  isOpen,
  onClose,
  onSuccess,
}: AddClientModalProps) {
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
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Obtener lista de países en español
  const countryList = useMemo(() => {
    const countryObj = countries.getNames("es", { select: "official" });

    return Object.entries(countryObj)
      .map(([code, name]) => ({ code, name }))
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
      console.log("[AddClientModal] Creating client:", formData);

      // Call API to create client
      const response = await fetch("/api/clients/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al crear cliente");
      }

      console.log("[AddClientModal] Client created successfully:", data.client);

      // Reset form
      setFormData({
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
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("[AddClientModal] Error creating client:", error);
      alert(
        `Error al crear cliente: ${error instanceof Error ? error.message : "Error desconocido"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
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
      });
      setErrors({});
      onClose();
    }
  };

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
            <div className="bg-slate-100 p-2 rounded-lg">
              <Icon
                className="text-slate-700 text-xl"
                icon="solar:user-plus-bold"
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Añadir Nuevo Cliente
              </h3>
              <p className="text-sm text-gray-500 font-normal">
                Complete la información del cliente
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-6">
            {/* Información Personal */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Icon
                  className="text-slate-700"
                  icon="solar:user-id-bold"
                  width={18}
                />
                Información Personal
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  isRequired
                  classNames={{
                    input: "focus:outline-none",
                    inputWrapper: "focus-within:outline-none",
                  }}
                  errorMessage={errors.firstName}
                  isInvalid={!!errors.firstName}
                  label="Nombre"
                  placeholder="Ej: Carlos"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:user-linear"
                      width={18}
                    />
                  }
                  value={formData.firstName}
                  onValueChange={(value) => handleChange("firstName", value)}
                />
                <Input
                  isRequired
                  classNames={{
                    input: "focus:outline-none",
                    inputWrapper: "focus-within:outline-none",
                  }}
                  errorMessage={errors.lastName}
                  isInvalid={!!errors.lastName}
                  label="Apellido"
                  placeholder="Ej: Ramirez"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:user-linear"
                      width={18}
                    />
                  }
                  value={formData.lastName}
                  onValueChange={(value) => handleChange("lastName", value)}
                />
                <Input
                  classNames={{
                    input: "focus:outline-none",
                    inputWrapper: "focus-within:outline-none",
                  }}
                  label="Apodo (Opcional)"
                  placeholder="Ej: Carl"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:user-speak-linear"
                      width={18}
                    />
                  }
                  value={formData.nickName}
                  onValueChange={(value) => handleChange("nickName", value)}
                />
                <Input
                  isRequired
                  classNames={{
                    input: "focus:outline-none",
                    inputWrapper: "focus-within:outline-none",
                  }}
                  errorMessage={errors.dob}
                  isInvalid={!!errors.dob}
                  label="Fecha de Nacimiento"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:calendar-linear"
                      width={18}
                    />
                  }
                  type="date"
                  value={formData.dob}
                  onValueChange={(value) => handleChange("dob", value)}
                />
                <Input
                  classNames={{
                    input: "focus:outline-none",
                    inputWrapper: "focus-within:outline-none",
                  }}
                  label="ID Nacional (Opcional)"
                  placeholder="Ej: ES12345678"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:card-linear"
                      width={18}
                    />
                  }
                  value={formData.nationalId}
                  onValueChange={(value) => handleChange("nationalId", value)}
                />
              </div>
            </div>

            {/* Información de Contacto */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Icon
                  className="text-slate-700"
                  icon="solar:phone-calling-bold"
                  width={18}
                />
                Información de Contacto
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  isRequired
                  classNames={{
                    input: "focus:outline-none",
                    inputWrapper: "focus-within:outline-none",
                  }}
                  errorMessage={errors.email}
                  isInvalid={!!errors.email}
                  label="Email"
                  placeholder="ejemplo@email.com"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:letter-linear"
                      width={18}
                    />
                  }
                  type="email"
                  value={formData.email}
                  onValueChange={(value) => handleChange("email", value)}
                />
                <Input
                  classNames={{
                    input: "focus:outline-none",
                    inputWrapper: "focus-within:outline-none",
                  }}
                  label="Teléfono (Opcional)"
                  placeholder="+34 600 000 000"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:phone-linear"
                      width={18}
                    />
                  }
                  value={formData.phone}
                  onValueChange={(value) => handleChange("phone", value)}
                />
              </div>
            </div>

            {/* Información Profesional */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Icon
                  className="text-slate-700"
                  icon="solar:case-bold"
                  width={18}
                />
                Información Profesional
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  classNames={{
                    input: "focus:outline-none",
                    inputWrapper: "focus-within:outline-none",
                  }}
                  label="Ocupación (Opcional)"
                  placeholder="Ej: Software Engineer"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:case-minimalistic-linear"
                      width={18}
                    />
                  }
                  value={formData.occupation}
                  onValueChange={(value) => handleChange("occupation", value)}
                />
              </div>
            </div>

            {/* Dirección */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Icon
                  className="text-slate-700"
                  icon="solar:map-point-bold"
                  width={18}
                />
                Dirección (Opcional)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  classNames={{
                    input: "focus:outline-none",
                    inputWrapper: "focus-within:outline-none",
                  }}
                  label="Ciudad"
                  placeholder="Ej: Madrid"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:city-linear"
                      width={18}
                    />
                  }
                  value={formData.city}
                  onValueChange={(value) => handleChange("city", value)}
                />
                <Input
                  classNames={{
                    input: "focus:outline-none",
                    inputWrapper: "focus-within:outline-none",
                  }}
                  label="Estado/Provincia"
                  placeholder="Ej: Madrid"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:map-linear"
                      width={18}
                    />
                  }
                  value={formData.state}
                  onValueChange={(value) => handleChange("state", value)}
                />
                <Autocomplete
                  allowsCustomValue={false}
                  classNames={{
                    base: "focus:outline-none",
                    selectorButton: "focus:outline-none",
                  }}
                  inputProps={{
                    classNames: {
                      input: "focus:outline-none",
                      inputWrapper: "focus-within:outline-none",
                    },
                  }}
                  label="País"
                  placeholder="Buscar país..."
                  selectedKey={formData.country || null}
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:global-linear"
                      width={18}
                    />
                  }
                  onSelectionChange={(key) => {
                    handleChange("country", (key as string) || "");
                  }}
                >
                  {countryList.map(
                    (country: { code: string; name: string }) => (
                      <AutocompleteItem key={country.name}>
                        {country.name}
                      </AutocompleteItem>
                    )
                  )}
                </Autocomplete>
                <Input
                  classNames={{
                    input: "focus:outline-none",
                    inputWrapper: "focus-within:outline-none",
                  }}
                  label="Código Postal"
                  placeholder="Ej: 28001"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:mailbox-linear"
                      width={18}
                    />
                  }
                  value={formData.zip}
                  onValueChange={(value) => handleChange("zip", value)}
                />
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={isLoading} variant="light" onPress={handleClose}>
            Cancelar
          </Button>
          <Button
            className="bg-black text-white hover:bg-slate-800"
            isLoading={isLoading}
            startContent={
              !isLoading ? (
                <Icon icon="solar:user-plus-bold" width={18} />
              ) : null
            }
            onPress={handleSubmit}
          >
            Añadir Cliente
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
