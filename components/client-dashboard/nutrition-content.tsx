"use client";

import { ClientBottomNav } from '@/components/client-dashboard/bottom-nav';
import { getMockNutritionPlan, calculateDayTotals, calculateMealTotals, type MockNutritionDay, type MockNutritionMeal } from '@/lib/mock-data/client-profile-mock';
import { Avatar, Button, Card, CardBody, Chip, Tabs, Tab } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useState, useMemo } from 'react';

interface NutritionContentProps {
    clientId: string;
    firstName: string;
    logoUrl?: string;
    trainerName: string;
    clientProfilePicture?: string;
}

export function NutritionContent({ clientId, firstName, logoUrl, trainerName, clientProfilePicture }: NutritionContentProps) {
    const nutritionPlan = getMockNutritionPlan(clientId);
    
    // Get today's day of the week in Spanish (Chicago timezone)
    const getTodayDayLabel = (): string => {
        const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const now = new Date();
        const chicagoTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
        return daysOfWeek[chicagoTime.getDay()] || 'Lunes';
    };

    const todayLabel = getTodayDayLabel();
    
    // Find today's day or default to first day
    const todayDay = nutritionPlan.days.find(d => d.dayLabel === todayLabel) || nutritionPlan.days[0]!;
    
    const [selectedDay, setSelectedDay] = useState<MockNutritionDay>(todayDay);
    const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());

    const currentStreak = 12; // Mock streak data
    
    const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    const toggleMeal = (mealId: string) => {
        setExpandedMeals(prev => {
            const newSet = new Set(prev);
            if (newSet.has(mealId)) {
                newSet.delete(mealId);
            } else {
                newSet.add(mealId);
            }
            return newSet;
        });
    };

    // Calculate daily totals
    const dayTotals = useMemo(() => calculateDayTotals(selectedDay), [selectedDay]);

    return (
        <>
            <div className="min-h-screen bg-background pb-20">
                <div className="max-w-lg mx-auto">
                    {/* Top Header - Same as Dashboard and Workouts */}
                    <div className="pt-4 px-4 pb-2">
                        {/* Logo Section - Separate from profile */}
                        {logoUrl && (
                            <div className="flex justify-center mb-4">
                                <img
                                    src={logoUrl}
                                    alt={trainerName}
                                    className="h-10 w-auto object-contain"
                                />
                            </div>
                        )}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {/* Client Profile Picture */}
                                <Avatar
                                    src={clientProfilePicture || ''}
                                    name={firstName}
                                    size="lg"
                                    className="w-12 h-12"
                                />
                                <div>
                                    <p className="text-sm text-foreground/70 font-body">Hola</p>
                                    <div className="flex items-center gap-1">
                                        <h1 className="text-lg font-semibold font-heading text-foreground">
                                            {firstName}
                                        </h1>
                                        <Icon icon="solar:alt-arrow-right-linear" className="text-foreground/60 text-lg" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    isIconOnly
                                    variant="light"
                                    size="sm"
                                    className="text-foreground/70"
                                >
                                    <Icon icon="solar:chat-round-dots-linear" className="text-2xl" />
                                </Button>
                                <Button
                                    isIconOnly
                                    variant="light"
                                    size="sm"
                                    className="text-foreground/70"
                                >
                                    <Icon icon="solar:bell-linear" className="text-2xl" />
                                </Button>
                            </div>
                        </div>

                        {/* Streak - Only show if >= 2 days */}
                        {currentStreak >= 2 && (
                            <div className="mb-4">
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:fire-bold" className="text-warning text-xl" />
                                    <p className="text-sm font-semibold text-foreground/80 tracking-wide">
                                        {currentStreak} Días en Racha
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Day Navigation - Tab Selector */}
                    <div className="px-4 mb-4">
                        <Tabs
                            selectedKey={selectedDay.dayLabel}
                            onSelectionChange={(key) => {
                                const dayData = nutritionPlan.days.find(d => d.dayLabel === key);
                                if (dayData) setSelectedDay(dayData);
                            }}
                            variant="bordered"
                            color="primary"
                            size="sm"
                            fullWidth
                            classNames={{
                                tabList: "gap-2",
                                cursor: "w-full",
                                tab: "px-2 h-9"
                            }}
                        >
                            {daysOfWeek.map((day) => {
                                const dayData = nutritionPlan.days.find(d => d.dayLabel === day);
                                if (!dayData) return null;
                                
                                return (
                                    <Tab key={day} title={day.slice(0, 3)} />
                                );
                            })}
                        </Tabs>
                    </div>

                    <div className="px-4 space-y-4">
                        {/* Daily Summary Card */}
                        <Card>
                            <CardBody className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon icon="solar:chart-2-bold" className="text-primary text-xl" />
                                    <h2 className="text-lg font-semibold font-heading text-foreground">
                                        Totales del Día
                                    </h2>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Calories */}
                                    <div className="bg-danger/10 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon icon="solar:fire-bold" className="text-danger text-lg" />
                                            <p className="text-xs font-medium text-foreground/70">Calorías</p>
                                        </div>
                                        <p className="text-2xl font-bold text-foreground">{Math.round(dayTotals.calories)}</p>
                                        <p className="text-xs text-foreground/60">kcal</p>
                                    </div>
                                    
                                    {/* Protein */}
                                    <div className="bg-primary/10 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon icon="solar:bone-bold" className="text-primary text-lg" />
                                            <p className="text-xs font-medium text-foreground/70">Proteína</p>
                                        </div>
                                        <p className="text-2xl font-bold text-foreground">{Math.round(dayTotals.protein)}</p>
                                        <p className="text-xs text-foreground/60">gramos</p>
                                    </div>
                                    
                                    {/* Carbs */}
                                    <div className="bg-warning/10 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon icon="solar:widget-2-bold" className="text-warning text-lg" />
                                            <p className="text-xs font-medium text-foreground/70">Carbohidratos</p>
                                        </div>
                                        <p className="text-2xl font-bold text-foreground">{Math.round(dayTotals.carbs)}</p>
                                        <p className="text-xs text-foreground/60">gramos</p>
                                    </div>
                                    
                                    {/* Fats */}
                                    <div className="bg-secondary/10 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon icon="solar:drop-bold" className="text-secondary text-lg" />
                                            <p className="text-xs font-medium text-foreground/70">Grasas</p>
                                        </div>
                                        <p className="text-2xl font-bold text-foreground">{Math.round(dayTotals.fats)}</p>
                                        <p className="text-xs text-foreground/60">gramos</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>

                        {/* Meals List */}
                        <div className="space-y-3">
                            <h2 className="text-lg font-semibold font-heading text-foreground">
                                Comidas del Día
                            </h2>
                            {selectedDay.meals.map((meal) => {
                                const isExpanded = expandedMeals.has(meal.id);
                                const mealTotals = calculateMealTotals(meal);
                                
                                return (
                                    <Card key={meal.id}>
                                        <CardBody className="p-4">
                                            {/* Meal Header - Clickable */}
                                            <div 
                                                className="cursor-pointer"
                                                onClick={() => toggleMeal(meal.id)}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3 flex-1">
                                                        <div className="bg-primary/10 p-2 rounded-lg flex-shrink-0">
                                                            <Icon icon="solar:dish-bold" className="text-primary text-xl" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h3 className="text-base font-bold text-foreground font-heading">
                                                                {meal.label}
                                                            </h3>
                                                            <p className="text-xs text-foreground/60">
                                                                {meal.ingredients.length} ingredientes
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Icon 
                                                        icon={isExpanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
                                                        className="text-foreground/60 text-xl flex-shrink-0" 
                                                    />
                                                </div>

                                                {/* Meal Macros Summary */}
                                                <div className="flex gap-2 flex-wrap">
                                                    <Chip size="sm" variant="flat" className="bg-danger/10 text-danger">
                                                        <div className="flex items-center gap-1">
                                                            <Icon icon="solar:fire-bold" className="text-xs" />
                                                            <span className="text-xs font-semibold">{Math.round(mealTotals.calories)} kcal</span>
                                                        </div>
                                                    </Chip>
                                                    <Chip size="sm" variant="flat" className="bg-primary/10 text-primary">
                                                        <span className="text-xs font-semibold">P: {Math.round(mealTotals.protein)}g</span>
                                                    </Chip>
                                                    <Chip size="sm" variant="flat" className="bg-warning/10 text-warning">
                                                        <span className="text-xs font-semibold">C: {Math.round(mealTotals.carbs)}g</span>
                                                    </Chip>
                                                    <Chip size="sm" variant="flat" className="bg-secondary/10 text-secondary">
                                                        <span className="text-xs font-semibold">G: {Math.round(mealTotals.fats)}g</span>
                                                    </Chip>
                                                </div>
                                            </div>

                                            {/* Expanded Content - Ingredients */}
                                            {isExpanded && (
                                                <div className="mt-4 space-y-3">
                                                    <div className="border-t border-default-200 pt-3">
                                                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                                            <Icon icon="solar:list-check-bold" className="text-primary" />
                                                            Ingredientes
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {meal.ingredients.map((ingredient) => (
                                                                <div 
                                                                    key={ingredient.id} 
                                                                    className="flex items-start justify-between bg-default-50 rounded-lg p-3"
                                                                >
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium text-foreground">
                                                                            {ingredient.name}
                                                                        </p>
                                                                        <p className="text-xs text-foreground/60">
                                                                            {ingredient.quantity} {ingredient.unit}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right flex-shrink-0 ml-3">
                                                                        <p className="text-xs text-foreground/60">
                                                                            P: {ingredient.protein}g · C: {ingredient.carbs}g · G: {ingredient.fats}g
                                                                        </p>
                                                                        <p className="text-xs font-semibold text-danger">
                                                                            {ingredient.calories} kcal
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Meal Notes */}
                                                    {meal.notes && (
                                                        <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                                                            <div className="flex items-start gap-2">
                                                                <Icon icon="solar:notes-bold" className="text-primary text-lg flex-shrink-0 mt-0.5" />
                                                                <div>
                                                                    <p className="text-xs font-semibold text-primary mb-1">Notas</p>
                                                                    <p className="text-sm text-foreground/80">{meal.notes}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardBody>
                                    </Card>
                                );
                            })}
                        </div>

                    </div>
                </div>
            </div>
            <ClientBottomNav />
        </>
    );
}
