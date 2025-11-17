"use client";

import { getMockNutritionPlan } from "@/lib/mock-data/client-profile-mock";
import { Button, Card, CardBody, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface NutritionTabProps {
    clientId: string;
}

export default function NutritionTab({ clientId }: NutritionTabProps) {
    const nutritionPlan = getMockNutritionPlan(clientId);
    const [isAddDayModalOpen, setIsAddDayModalOpen] = useState(false);
    const [isAddMealModalOpen, setIsAddMealModalOpen] = useState(false);
    const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
    const [addingIngredientToMeal, setAddingIngredientToMeal] = useState<string | null>(null);
    const [editingIngredient, setEditingIngredient] = useState<string | null>(null);

    const [dayForm, setDayForm] = useState({
        dayLabel: '',
        notes: ''
    });

    const [mealForm, setMealForm] = useState({
        label: '',
        notes: ''
    });

    const [newIngredient, setNewIngredient] = useState({
        name: '',
        quantity: '',
        unit: ''
    });

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // Day handlers
    const handleOpenAddDay = () => {
        setIsAddDayModalOpen(true);
    };

    const handleCloseAddDay = () => {
        setIsAddDayModalOpen(false);
        setDayForm({ dayLabel: '', notes: '' });
    };

    const handleSaveDay = () => {
        console.log('Guardando día:', dayForm);
        handleCloseAddDay();
    };

    const handleEditDay = (dayId: string) => {
        console.log('Editando día:', dayId);
    };

    const handleDeleteDay = (dayId: string) => {
        console.log('Eliminando día:', dayId);
    };

    // Meal handlers
    const handleOpenAddMeal = (dayId: string) => {
        setSelectedDayId(dayId);
        setIsAddMealModalOpen(true);
    };

    const handleCloseAddMeal = () => {
        setIsAddMealModalOpen(false);
        setSelectedDayId(null);
        setMealForm({ label: '', notes: '' });
    };

    const handleSaveMeal = () => {
        console.log('Guardando comida:', mealForm, 'para día:', selectedDayId);
        handleCloseAddMeal();
    };

    const handleEditMeal = (mealId: string) => {
        console.log('Editando comida:', mealId);
    };

    const handleDeleteMeal = (mealId: string) => {
        console.log('Eliminando comida:', mealId);
    };

    // Ingredient handlers - Inline
    const handleAddIngredientClick = (mealId: string) => {
        setAddingIngredientToMeal(mealId);
        setNewIngredient({ name: '', quantity: '', unit: '' });
    };

    const handleSaveNewIngredient = (mealId: string) => {
        console.log('Guardando ingrediente:', newIngredient, 'para comida:', mealId);
        setAddingIngredientToMeal(null);
        setNewIngredient({ name: '', quantity: '', unit: '' });
    };

    const handleCancelNewIngredient = () => {
        setAddingIngredientToMeal(null);
        setNewIngredient({ name: '', quantity: '', unit: '' });
    };

    const handleEditIngredientClick = (ingredientId: string) => {
        setEditingIngredient(ingredientId);
    };

    const handleSaveEditIngredient = (ingredientId: string) => {
        console.log('Guardando edición de ingrediente:', ingredientId);
        setEditingIngredient(null);
    };

    const handleCancelEditIngredient = () => {
        setEditingIngredient(null);
    };

    const handleDeleteIngredient = (ingredientId: string) => {
        console.log('Eliminando ingrediente:', ingredientId);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Nutrición</h2>
                    <p className="text-sm text-gray-600 mt-1">{nutritionPlan.name}</p>
                </div>
                <Button
                    color="primary"
                    startContent={<Icon icon="solar:add-circle-bold" width={20} />}
                    className="text-white font-semibold"
                    onPress={handleOpenAddDay}
                >
                    Añadir Día
                </Button>
            </div>

            {/* Days List */}
            <div className="space-y-3">
                {nutritionPlan.days.map((day) => (
                    <details key={day.id} className="group">
                        <summary className="flex items-center justify-between cursor-pointer list-none p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                            <div className="flex items-center gap-4 flex-1">
                                <div className="bg-blue-50 p-2 rounded-lg">
                                    <Icon icon="solar:calendar-bold" className="text-blue-600" width={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-gray-900">{day.dayLabel}</h3>
                                    <p className="text-sm text-gray-600">{day.meals.length} comidas</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        color="primary"
                                        variant="flat"
                                        startContent={<Icon icon="solar:add-circle-bold" width={16} />}
                                        onPress={(e: any) => {
                                            e?.preventDefault?.();
                                            handleOpenAddMeal(day.id);
                                        }}
                                        className="text-white font-semibold"
                                    >
                                        Añadir Comida
                                    </Button>
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="flat"
                                        onPress={(e: any) => {
                                            e?.preventDefault?.();
                                            handleEditDay(day.id);
                                        }}
                                    >
                                        <Icon icon="solar:pen-linear" className="text-gray-600" width={18} />
                                    </Button>
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="flat"
                                        onPress={(e: any) => {
                                            e?.preventDefault?.();
                                            handleDeleteDay(day.id);
                                        }}
                                    >
                                        <Icon icon="solar:trash-bin-trash-linear" className="text-gray-600" width={18} />
                                    </Button>
                                    <Icon
                                        icon="solar:alt-arrow-down-linear"
                                        className="text-gray-400 group-open:rotate-180 transition-transform"
                                        width={20}
                                    />
                                </div>
                            </div>
                        </summary>

                        {/* Meals - Collapsed Content */}
                        <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="space-y-3">
                                {day.meals.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Icon icon="solar:dish-linear" className="text-gray-300 mx-auto mb-2" width={48} />
                                        <p className="text-sm text-gray-500">No hay comidas en este día</p>
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            color="primary"
                                            className="mt-3 text-white font-semibold"
                                            startContent={<Icon icon="solar:add-circle-bold" width={16} />}
                                            onPress={() => handleOpenAddMeal(day.id)}
                                        >
                                            Añadir Primera Comida
                                        </Button>
                                    </div>
                                ) : (
                                    day.meals.map((meal) => (
                                        <div key={meal.id} className="bg-white rounded-lg border border-gray-200 p-4">
                                            {/* Meal Header */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Icon icon="solar:dish-bold" className="text-blue-600" width={20} />
                                                    <h4 className="font-bold text-gray-900">{meal.label}</h4>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        isIconOnly
                                                        size="sm"
                                                        variant="flat"
                                                        onPress={() => handleEditMeal(meal.id)}
                                                    >
                                                        <Icon icon="solar:pen-linear" className="text-gray-600" width={16} />
                                                    </Button>
                                                    <Button
                                                        isIconOnly
                                                        size="sm"
                                                        variant="flat"
                                                        onPress={() => handleDeleteMeal(meal.id)}
                                                    >
                                                        <Icon icon="solar:trash-bin-trash-linear" className="text-gray-600" width={16} />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Ingredients Table */}
                                            <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
                                                <div className="space-y-2">
                                                    {meal.ingredients.map((ingredient) => (
                                                        <div key={ingredient.id}>
                                                            {editingIngredient === ingredient.id ? (
                                                                // Edit mode
                                                                <div className="flex items-center gap-2 py-2 border-b border-gray-100">
                                                                    <Input
                                                                        size="sm"
                                                                        placeholder="Ingrediente"
                                                                        defaultValue={ingredient.name}
                                                                        className="flex-1"
                                                                    />
                                                                    <Input
                                                                        size="sm"
                                                                        placeholder="Cantidad"
                                                                        defaultValue={ingredient.quantity}
                                                                        className="w-24"
                                                                    />
                                                                    <Input
                                                                        size="sm"
                                                                        placeholder="Unidad"
                                                                        defaultValue={ingredient.unit}
                                                                        className="w-24"
                                                                    />
                                                                    <Button
                                                                        isIconOnly
                                                                        size="sm"
                                                                        color="success"
                                                                        variant="flat"
                                                                        onPress={() => handleSaveEditIngredient(ingredient.id)}
                                                                    >
                                                                        <Icon icon="solar:check-circle-bold" width={18} />
                                                                    </Button>
                                                                    <Button
                                                                        isIconOnly
                                                                        size="sm"
                                                                        variant="flat"
                                                                        onPress={handleCancelEditIngredient}
                                                                    >
                                                                        <Icon icon="solar:close-circle-bold" width={18} />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                // View mode
                                                                <div
                                                                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-white cursor-pointer rounded px-2"
                                                                    onClick={() => handleEditIngredientClick(ingredient.id)}
                                                                >
                                                                    <div className="flex items-center gap-3 flex-1">
                                                                        <span className="text-sm text-gray-900">{ingredient.name}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="text-sm text-gray-600">
                                                                            <span className="font-semibold text-gray-900">{ingredient.quantity}</span> {ingredient.unit}
                                                                        </div>
                                                                        <Button
                                                                            isIconOnly
                                                                            size="sm"
                                                                            variant="light"
                                                                            onPress={(e: any) => {
                                                                                e?.stopPropagation?.();
                                                                                handleDeleteIngredient(ingredient.id);
                                                                            }}
                                                                        >
                                                                            <Icon icon="solar:trash-bin-trash-linear" className="text-gray-400 hover:text-red-600" width={16} />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}

                                                    {/* Add new ingredient inline */}
                                                    {addingIngredientToMeal === meal.id ? (
                                                        <div className="flex items-center gap-2 py-2 border-b border-blue-200 bg-blue-50 rounded px-2">
                                                            <Input
                                                                size="sm"
                                                                placeholder="Nombre del ingrediente"
                                                                value={newIngredient.name}
                                                                onValueChange={(value) => setNewIngredient({ ...newIngredient, name: value })}
                                                                className="flex-1"
                                                                autoFocus
                                                            />
                                                            <Input
                                                                size="sm"
                                                                placeholder="Cantidad"
                                                                value={newIngredient.quantity}
                                                                onValueChange={(value) => setNewIngredient({ ...newIngredient, quantity: value })}
                                                                className="w-24"
                                                            />
                                                            <Input
                                                                size="sm"
                                                                placeholder="Unidad"
                                                                value={newIngredient.unit}
                                                                onValueChange={(value) => setNewIngredient({ ...newIngredient, unit: value })}
                                                                className="w-24"
                                                            />
                                                            <Button
                                                                isIconOnly
                                                                size="sm"
                                                                color="primary"
                                                                onPress={() => handleSaveNewIngredient(meal.id)}
                                                                className="text-white"
                                                            >
                                                                <Icon icon="solar:check-circle-bold" width={18} />
                                                            </Button>
                                                            <Button
                                                                isIconOnly
                                                                size="sm"
                                                                variant="flat"
                                                                onPress={handleCancelNewIngredient}
                                                            >
                                                                <Icon icon="solar:close-circle-bold" width={18} />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="light"
                                                            startContent={<Icon icon="solar:add-circle-linear" width={16} />}
                                                            onPress={() => handleAddIngredientClick(meal.id)}
                                                            className="w-full mt-2"
                                                        >
                                                            Añadir Ingrediente
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Meal Notes */}
                                            {meal.notes && (
                                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                                    <div className="flex items-start gap-2">
                                                        <Icon icon="solar:notes-bold" className="text-blue-600 mt-0.5 flex-shrink-0" width={16} />
                                                        <p className="text-sm text-blue-700">{meal.notes}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </details>
                ))}
            </div>

            {/* Plan Notes */}
            {nutritionPlan.notes && (
                <Card className="bg-blue-50 border border-blue-100">
                    <CardBody className="p-4">
                        <div className="flex items-start gap-2">
                            <Icon icon="solar:info-circle-bold" className="text-blue-600 mt-0.5 flex-shrink-0" width={18} />
                            <div>
                                <p className="text-sm font-semibold text-blue-900 mb-1">Notas del Plan</p>
                                <p className="text-sm text-blue-700">{nutritionPlan.notes}</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* Add Day Modal */}
            <Modal
                isOpen={isAddDayModalOpen}
                onClose={handleCloseAddDay}
                size="lg"
                classNames={{
                    header: "border-b border-gray-200",
                    footer: "border-t border-gray-200",
                    body: "py-6"
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-50 p-2 rounded-lg">
                                <Icon icon="solar:calendar-add-bold" className="text-blue-600 text-xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Añadir Día</h3>
                                <p className="text-sm text-gray-500 font-normal">Define el día para el plan nutricional</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <div className="flex flex-col gap-4">
                            <Input
                                label="Nombre del Día"
                                placeholder='Ej: "Día 1" o "Lunes"'
                                value={dayForm.dayLabel}
                                onValueChange={(value) => setDayForm({ ...dayForm, dayLabel: value })}
                                isRequired
                                startContent={<Icon icon="solar:calendar-linear" className="text-gray-400" width={18} />}
                            />
                            <Textarea
                                label="Notas del Día (Opcional)"
                                placeholder="Ej: Día de alta intensidad, aumentar hidratación..."
                                value={dayForm.notes}
                                onValueChange={(value) => setDayForm({ ...dayForm, notes: value })}
                                minRows={3}
                                startContent={<Icon icon="solar:notes-linear" className="text-gray-400" width={18} />}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={handleCloseAddDay}>
                            Cancelar
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleSaveDay}
                            startContent={<Icon icon="solar:add-circle-bold" width={18} />}
                            className="text-white font-semibold"
                        >
                            Crear Día
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Add Meal Modal */}
            <Modal
                isOpen={isAddMealModalOpen}
                onClose={handleCloseAddMeal}
                size="lg"
                classNames={{
                    header: "border-b border-gray-200",
                    footer: "border-t border-gray-200",
                    body: "py-6"
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-50 p-2 rounded-lg">
                                <Icon icon="solar:dish-bold" className="text-blue-600 text-xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Añadir Comida</h3>
                                <p className="text-sm text-gray-500 font-normal">Define la etiqueta de la comida</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <div className="flex flex-col gap-4">
                            <Input
                                label="Etiqueta de la Comida"
                                placeholder='Ej: "Meal 1 - Breakfast" o "Desayuno"'
                                value={mealForm.label}
                                onValueChange={(value) => setMealForm({ ...mealForm, label: value })}
                                isRequired
                                startContent={<Icon icon="solar:document-text-linear" className="text-gray-400" width={18} />}
                            />
                            <Textarea
                                label="Notas de la Comida (Opcional)"
                                placeholder="Ej: Scramble with Spinach and Whole Grain Toast..."
                                value={mealForm.notes}
                                onValueChange={(value) => setMealForm({ ...mealForm, notes: value })}
                                minRows={3}
                                startContent={<Icon icon="solar:notes-linear" className="text-gray-400" width={18} />}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={handleCloseAddMeal}>
                            Cancelar
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleSaveMeal}
                            startContent={<Icon icon="solar:add-circle-bold" width={18} />}
                            className="text-white font-semibold"
                        >
                            Crear Comida
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
