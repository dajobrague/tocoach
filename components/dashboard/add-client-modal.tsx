"use client";

import { Autocomplete, AutocompleteItem, Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
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

export default function AddClientModal({ isOpen, onClose, onSuccess }: AddClientModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        nickName: '',
        email: '',
        phone: '',
        occupation: '',
        dob: '',
        city: '',
        state: '',
        country: '',
        zip: '',
        nationalId: '',
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
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when user types
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.firstName.trim()) {
            newErrors.firstName = 'El nombre es requerido';
        }
        if (!formData.lastName.trim()) {
            newErrors.lastName = 'El apellido es requerido';
        }
        if (!formData.email.trim()) {
            newErrors.email = 'El email es requerido';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Email inválido';
        }
        if (!formData.dob.trim()) {
            newErrors.dob = 'La fecha de nacimiento es requerida';
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
            // TODO: Implement API call to create client
            console.log('Creating client:', formData);

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Reset form
            setFormData({
                firstName: '',
                lastName: '',
                nickName: '',
                email: '',
                phone: '',
                occupation: '',
                dob: '',
                city: '',
                state: '',
                country: '',
                zip: '',
                nationalId: '',
            });

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error creating client:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setFormData({
                firstName: '',
                lastName: '',
                nickName: '',
                email: '',
                phone: '',
                occupation: '',
                dob: '',
                city: '',
                state: '',
                country: '',
                zip: '',
                nationalId: '',
            });
            setErrors({});
            onClose();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            size="3xl"
            scrollBehavior="inside"
            classNames={{
                base: "max-h-[90vh]",
                header: "border-b border-gray-200",
                footer: "border-t border-gray-200",
                body: "py-6"
            }}
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-50 p-2 rounded-lg">
                            <Icon icon="solar:user-plus-bold" className="text-blue-600 text-xl" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Añadir Nuevo Cliente</h3>
                            <p className="text-sm text-gray-500 font-normal">Complete la información del cliente</p>
                        </div>
                    </div>
                </ModalHeader>
                <ModalBody>
                    <div className="flex flex-col gap-6">
                        {/* Información Personal */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Icon icon="solar:user-id-bold" className="text-blue-600" width={18} />
                                Información Personal
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Nombre"
                                    placeholder="Ej: Carlos"
                                    value={formData.firstName}
                                    onValueChange={(value) => handleChange('firstName', value)}
                                    isInvalid={!!errors.firstName}
                                    errorMessage={errors.firstName}
                                    isRequired
                                    startContent={<Icon icon="solar:user-linear" className="text-gray-400" width={18} />}
                                    classNames={{
                                        input: "focus:outline-none",
                                        inputWrapper: "focus-within:outline-none"
                                    }}
                                />
                                <Input
                                    label="Apellido"
                                    placeholder="Ej: Ramirez"
                                    value={formData.lastName}
                                    onValueChange={(value) => handleChange('lastName', value)}
                                    isInvalid={!!errors.lastName}
                                    errorMessage={errors.lastName}
                                    isRequired
                                    startContent={<Icon icon="solar:user-linear" className="text-gray-400" width={18} />}
                                    classNames={{
                                        input: "focus:outline-none",
                                        inputWrapper: "focus-within:outline-none"
                                    }}
                                />
                                <Input
                                    label="Apodo (Opcional)"
                                    placeholder="Ej: Carl"
                                    value={formData.nickName}
                                    onValueChange={(value) => handleChange('nickName', value)}
                                    startContent={<Icon icon="solar:user-speak-linear" className="text-gray-400" width={18} />}
                                    classNames={{
                                        input: "focus:outline-none",
                                        inputWrapper: "focus-within:outline-none"
                                    }}
                                />
                                <Input
                                    label="Fecha de Nacimiento"
                                    type="date"
                                    value={formData.dob}
                                    onValueChange={(value) => handleChange('dob', value)}
                                    isInvalid={!!errors.dob}
                                    errorMessage={errors.dob}
                                    isRequired
                                    startContent={<Icon icon="solar:calendar-linear" className="text-gray-400" width={18} />}
                                    classNames={{
                                        input: "focus:outline-none",
                                        inputWrapper: "focus-within:outline-none"
                                    }}
                                />
                                <Input
                                    label="ID Nacional (Opcional)"
                                    placeholder="Ej: ES12345678"
                                    value={formData.nationalId}
                                    onValueChange={(value) => handleChange('nationalId', value)}
                                    startContent={<Icon icon="solar:card-linear" className="text-gray-400" width={18} />}
                                    classNames={{
                                        input: "focus:outline-none",
                                        inputWrapper: "focus-within:outline-none"
                                    }}
                                />
                            </div>
                        </div>

                        {/* Información de Contacto */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Icon icon="solar:phone-calling-bold" className="text-blue-600" width={18} />
                                Información de Contacto
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Email"
                                    type="email"
                                    placeholder="ejemplo@email.com"
                                    value={formData.email}
                                    onValueChange={(value) => handleChange('email', value)}
                                    isInvalid={!!errors.email}
                                    errorMessage={errors.email}
                                    isRequired
                                    startContent={<Icon icon="solar:letter-linear" className="text-gray-400" width={18} />}
                                    classNames={{
                                        input: "focus:outline-none",
                                        inputWrapper: "focus-within:outline-none"
                                    }}
                                />
                                <Input
                                    label="Teléfono (Opcional)"
                                    placeholder="+34 600 000 000"
                                    value={formData.phone}
                                    onValueChange={(value) => handleChange('phone', value)}
                                    startContent={<Icon icon="solar:phone-linear" className="text-gray-400" width={18} />}
                                    classNames={{
                                        input: "focus:outline-none",
                                        inputWrapper: "focus-within:outline-none"
                                    }}
                                />
                            </div>
                        </div>

                        {/* Información Profesional */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Icon icon="solar:case-bold" className="text-blue-600" width={18} />
                                Información Profesional
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Ocupación (Opcional)"
                                    placeholder="Ej: Software Engineer"
                                    value={formData.occupation}
                                    onValueChange={(value) => handleChange('occupation', value)}
                                    startContent={<Icon icon="solar:case-minimalistic-linear" className="text-gray-400" width={18} />}
                                    classNames={{
                                        input: "focus:outline-none",
                                        inputWrapper: "focus-within:outline-none"
                                    }}
                                />
                            </div>
                        </div>

                        {/* Dirección */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Icon icon="solar:map-point-bold" className="text-blue-600" width={18} />
                                Dirección (Opcional)
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Ciudad"
                                    placeholder="Ej: Madrid"
                                    value={formData.city}
                                    onValueChange={(value) => handleChange('city', value)}
                                    startContent={<Icon icon="solar:city-linear" className="text-gray-400" width={18} />}
                                    classNames={{
                                        input: "focus:outline-none",
                                        inputWrapper: "focus-within:outline-none"
                                    }}
                                />
                                <Input
                                    label="Estado/Provincia"
                                    placeholder="Ej: Madrid"
                                    value={formData.state}
                                    onValueChange={(value) => handleChange('state', value)}
                                    startContent={<Icon icon="solar:map-linear" className="text-gray-400" width={18} />}
                                    classNames={{
                                        input: "focus:outline-none",
                                        inputWrapper: "focus-within:outline-none"
                                    }}
                                />
                                <Autocomplete
                                    label="País"
                                    placeholder="Buscar país..."
                                    selectedKey={formData.country || null}
                                    onSelectionChange={(key) => {
                                        handleChange('country', key as string || '');
                                    }}
                                    startContent={<Icon icon="solar:global-linear" className="text-gray-400" width={18} />}
                                    classNames={{
                                        base: "focus:outline-none",
                                        selectorButton: "focus:outline-none"
                                    }}
                                    allowsCustomValue={false}
                                    inputProps={{
                                        classNames: {
                                            input: "focus:outline-none",
                                            inputWrapper: "focus-within:outline-none"
                                        }
                                    }}
                                >
                                    {countryList.map((country: { code: string; name: string }) => (
                                        <AutocompleteItem key={country.name}>
                                            {country.name}
                                        </AutocompleteItem>
                                    ))}
                                </Autocomplete>
                                <Input
                                    label="Código Postal"
                                    placeholder="Ej: 28001"
                                    value={formData.zip}
                                    onValueChange={(value) => handleChange('zip', value)}
                                    startContent={<Icon icon="solar:mailbox-linear" className="text-gray-400" width={18} />}
                                    classNames={{
                                        input: "focus:outline-none",
                                        inputWrapper: "focus-within:outline-none"
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button
                        variant="light"
                        onPress={handleClose}
                        isDisabled={isLoading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        color="primary"
                        onPress={handleSubmit}
                        isLoading={isLoading}
                        startContent={!isLoading ? <Icon icon="solar:user-plus-bold" width={18} /> : null}
                    >
                        Añadir Cliente
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

