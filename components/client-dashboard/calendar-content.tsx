"use client";

import { ClientBottomNav } from '@/components/client-dashboard/bottom-nav';
import { Card, CardBody, Button, Chip, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { Icon } from '@iconify/react';
import { getMockCalendarEvents, type MockCalendarEvent } from '@/lib/mock-data/client-profile-mock';
import { useState, useMemo } from 'react';

interface CalendarContentProps {
    logoUrl?: string;
    trainerName: string;
}

const getEventIcon = (type: MockCalendarEvent['type']) => {
    switch (type) {
        case 'workout':
            return 'solar:dumbbell-bold-duotone';
        case 'cardio':
            return 'solar:running-round-bold-duotone';
        case 'meeting':
            return 'solar:videocamera-record-bold-duotone';
        case 'check-in':
            return 'solar:clipboard-check-bold-duotone';
        case 'rest':
            return 'solar:sleeping-bold-duotone';
        case 'nutrition-prep':
            return 'solar:chef-hat-bold-duotone';
        default:
            return 'solar:calendar-bold-duotone';
    }
};

const getEventColor = (type: MockCalendarEvent['type']) => {
    switch (type) {
        case 'workout':
            return 'bg-primary';
        case 'cardio':
            return 'bg-secondary';
        case 'meeting':
            return 'bg-warning';
        case 'check-in':
            return 'bg-success';
        case 'rest':
            return 'bg-default';
        case 'nutrition-prep':
            return 'bg-secondary';
        default:
            return 'bg-default';
    }
};

export function CalendarContent({ logoUrl, trainerName }: CalendarContentProps) {
    const allEvents = getMockCalendarEvents('demo-client-id');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const today = new Date().toISOString().split('T')[0]!;
    
    // Group events by date
    const eventsByDate = useMemo(() => {
        const groups: { [date: string]: MockCalendarEvent[] } = {};
        allEvents.forEach(event => {
            if (!groups[event.date]) {
                groups[event.date] = [];
            }
            groups[event.date]!.push(event);
        });
        return groups;
    }, [allEvents]);
    
    // Get calendar days for current month
    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
        
        const days: Array<{ date: string; day: number; isCurrentMonth: boolean; isToday: boolean; events: MockCalendarEvent[] }> = [];
        
        // Add previous month's trailing days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            const date = new Date(year, month - 1, day);
            const dateStr = date.toISOString().split('T')[0]!;
            days.push({
                date: dateStr,
                day,
                isCurrentMonth: false,
                isToday: dateStr === today,
                events: eventsByDate[dateStr] || []
            });
        }
        
        // Add current month's days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = date.toISOString().split('T')[0]!;
            days.push({
                date: dateStr,
                day,
                isCurrentMonth: true,
                isToday: dateStr === today,
                events: eventsByDate[dateStr] || []
            });
        }
        
        // Add next month's leading days to complete the grid
        const remainingDays = 42 - days.length; // 6 rows * 7 days
        for (let day = 1; day <= remainingDays; day++) {
            const date = new Date(year, month + 1, day);
            const dateStr = date.toISOString().split('T')[0]!;
            days.push({
                date: dateStr,
                day,
                isCurrentMonth: false,
                isToday: dateStr === today,
                events: eventsByDate[dateStr] || []
            });
        }
        
        return days;
    }, [currentDate, eventsByDate, today]);
    
    const selectedDateEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];
    
    const goToPreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };
    
    const goToNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };
    
    const goToToday = () => {
        setCurrentDate(new Date());
    };
    
    const handleDateClick = (dateStr: string) => {
        setSelectedDate(dateStr);
        setIsModalOpen(true);
    };
    
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    const formatSelectedDate = (dateStr: string): string => {
        const date = new Date(dateStr + 'T12:00:00');
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return `${days[date.getDay()]}, ${date.getDate()} de ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    };
    
    return (
        <>
            <div className="min-h-screen bg-background p-4 pb-20">
                <div className="max-w-lg mx-auto space-y-4">
                    {/* Logo Header */}
                    {logoUrl && (
                        <div className="pt-6 flex justify-center">
                            <img
                                src={logoUrl}
                                alt={trainerName}
                                className="h-12 w-auto"
                            />
                        </div>
                    )}

                    {/* Header */}
                    <div className={`${logoUrl ? 'pt-4' : 'pt-8'} pb-2`}>
                        <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
                            Calendario
                        </h1>
                        <p className="text-default-500 font-body text-sm">
                            Tus entrenamientos y actividades programadas
                        </p>
                    </div>

                    {/* Calendar Card */}
                    <Card>
                        <CardBody className="p-3">
                            {/* Month Navigation */}
                            <div className="flex items-center justify-between mb-4">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    onPress={goToPreviousMonth}
                                >
                                    <Icon icon="solar:alt-arrow-left-bold" className="text-lg" />
                                </Button>
                                
                                <div className="text-center">
                                    <h2 className="font-heading font-bold text-lg text-foreground">
                                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                                    </h2>
                                </div>
                                
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    onPress={goToNextMonth}
                                >
                                    <Icon icon="solar:alt-arrow-right-bold" className="text-lg" />
                                </Button>
                            </div>
                            
                            <div className="mb-3 flex justify-center">
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="primary"
                                    onPress={goToToday}
                                >
                                    Hoy
                                </Button>
                            </div>
                            
                            {/* Day Names */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {dayNames.map(day => (
                                    <div key={day} className="text-center text-xs font-semibold text-default-500 py-1">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            
                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((dayInfo, index) => {
                                    const hasEvents = dayInfo.events.length > 0;
                                    const eventTypes = [...new Set(dayInfo.events.map(e => e.type))];
                                    
                                    return (
                                        <button
                                            key={`${dayInfo.date}-${index}`}
                                            onClick={() => hasEvents && handleDateClick(dayInfo.date)}
                                            className={`
                                                aspect-square rounded-lg p-1 flex flex-col items-center justify-center
                                                transition-all relative
                                                ${dayInfo.isCurrentMonth ? 'text-foreground' : 'text-default-300'}
                                                ${dayInfo.isToday ? 'bg-primary font-bold' : ''}
                                                ${hasEvents && !dayInfo.isToday ? 'bg-default-100 hover:bg-default-200' : ''}
                                                ${hasEvents ? 'cursor-pointer' : 'cursor-default'}
                                            `}
                                        >
                                            <span className={`text-sm ${dayInfo.isToday ? 'font-bold text-white' : ''}`}>
                                                {dayInfo.day}
                                            </span>
                                            
                                            {/* Event indicators */}
                                            {hasEvents && (
                                                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                                                    {eventTypes.slice(0, 3).map((type, idx) => (
                                                        <div
                                                            key={`${type}-${idx}`}
                                                            className={`w-1 h-1 rounded-full ${getEventColor(type)}`}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {dayInfo.events.length > 3 && (
                                                <span className="text-[8px] text-default-500 mt-0.5">
                                                    +{dayInfo.events.length - 3}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </CardBody>
                    </Card>
                    
                    {/* Legend */}
                    <Card>
                        <CardBody className="p-3">
                            <p className="text-xs font-semibold text-default-600 mb-2 font-heading">Leyenda</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:dumbbell-bold-duotone" className="text-primary text-base" />
                                    <span className="text-default-600">Entrenamiento</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:running-round-bold-duotone" className="text-secondary text-base" />
                                    <span className="text-default-600">Cardio</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:videocamera-record-bold-duotone" className="text-warning text-base" />
                                    <span className="text-default-600">Reunión</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:clipboard-check-bold-duotone" className="text-success text-base" />
                                    <span className="text-default-600">Check-in</span>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>
            
            {/* Event Details Modal */}
            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)}
                scrollBehavior="inside"
                size="lg"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <h3 className="text-lg font-heading font-bold">
                            {selectedDate && formatSelectedDate(selectedDate)}
                        </h3>
                        <p className="text-sm text-default-500 font-body font-normal">
                            {selectedDateEvents.length} {selectedDateEvents.length === 1 ? 'evento' : 'eventos'}
                        </p>
                    </ModalHeader>
                    <ModalBody className="pb-6">
                        {selectedDateEvents.length > 0 ? (
                            <div className="space-y-3">
                                {selectedDateEvents.map(event => (
                                    <Card key={event.id} shadow="none" className="bg-default-50">
                                        <CardBody className="p-3">
                                            <div className="flex items-start gap-3">
                                                {/* Icon */}
                                                <div className={`${getEventColor(event.type)}/20 p-2 rounded-lg flex-shrink-0`}>
                                                    <Icon 
                                                        icon={getEventIcon(event.type)} 
                                                        className={`${getEventColor(event.type).replace('bg-', 'text-')} text-lg`}
                                                    />
                                                </div>
                                                
                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <h4 className="font-heading font-semibold text-foreground text-sm">
                                                            {event.title}
                                                        </h4>
                                                        {event.time && (
                                                            <Chip 
                                                                size="sm" 
                                                                variant="flat"
                                                                startContent={<Icon icon="solar:clock-circle-bold" className="text-xs" />}
                                                                classNames={{
                                                                    base: "h-5",
                                                                    content: "text-xs px-1"
                                                                }}
                                                            >
                                                                {event.time}
                                                            </Chip>
                                                        )}
                                                    </div>
                                                    
                                                    {event.description && (
                                                        <p className="text-xs text-default-500 font-body mb-2">
                                                            {event.description}
                                                        </p>
                                                    )}
                                                    
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {event.duration && (
                                                            <Chip size="sm" variant="flat" className="text-xs h-5">
                                                                {event.duration} min
                                                            </Chip>
                                                        )}
                                                        
                                                        {event.reminder && (
                                                            <Chip 
                                                                size="sm" 
                                                                variant="flat" 
                                                                color="warning"
                                                                startContent={<Icon icon="solar:bell-bold" className="text-xs" />}
                                                                className="text-xs h-5"
                                                            >
                                                                Recordatorio
                                                            </Chip>
                                                        )}
                                                        
                                                        {event.status === 'completed' && (
                                                            <Chip 
                                                                size="sm" 
                                                                variant="flat" 
                                                                color="success"
                                                                startContent={<Icon icon="solar:check-circle-bold" className="text-xs" />}
                                                                className="text-xs h-5"
                                                            >
                                                                Completado
                                                            </Chip>
                                                        )}
                                                    </div>
                                                    
                                                    {event.notes && (
                                                        <div className="mt-2 p-2 bg-default-100 rounded-lg">
                                                            <p className="text-xs text-default-600 font-body">
                                                                <Icon icon="solar:notes-minimalistic-bold-duotone" className="inline text-sm mr-1" />
                                                                {event.notes}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Icon icon="solar:calendar-line-duotone" className="text-default-300 text-5xl mx-auto mb-3" />
                                <p className="text-default-500 text-sm">No hay eventos para este día</p>
                            </div>
                        )}
                    </ModalBody>
                </ModalContent>
            </Modal>
            
            <ClientBottomNav />
        </>
    );
}

