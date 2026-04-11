'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TimePicker } from '@/components/ui/time-picker';
import { Calendar, Check, Clock, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface AvailabilitySlot {
    start: string;
    end: string;
    timezone: string;
}

interface DayAvailability {
    dayOfWeek: string;
    slots: AvailabilitySlot[];
}

interface AvailabilityScheduleProps {
    availability: DayAvailability[];
    onChange: (availability: DayAvailability[]) => void;
}

const daysOfWeek = [
    'lunes',
    'martes',
    'miercoles',
    'jueves',
    'viernes',
    'sábado',
    'domingo',
];

const dayLabels = {
    lunes: 'Lunes',
    martes: 'Martes',
    miercoles: 'Miércoles',
    jueves: 'Jueves',
    viernes: 'Viernes',
    sábado: 'Sábado',
    domingo: 'Domingo',
};

// Función para convertir tiempo de 24h a 12h con AM/PM
const formatTime12Hour = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    if (minutes === undefined) return '';
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Función para convertir tiempo de 12h a 24h
const formatTime24Hour = (time12: string, period: string): string => {
    const [hours, minutes] = time12.split(':').map(Number);
    let hours24 = hours;

    if (period === 'AM' && hours === 12) {
        hours24 = 0;
    } else if (period === 'PM' && hours !== 12) {
        hours24 = hours + 12;
    }

    return `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export function AvailabilitySchedule({
    availability,
    onChange,
}: AvailabilityScheduleProps) {
    const [dayStates, setDayStates] = useState<
        Record<
            string,
            {
                isAvailable: boolean;
                startTime: string;
                endTime: string;
            }
        >
    >(
        daysOfWeek.reduce(
            (acc, day) => {
                const existingDay = availability.find((a) => a.dayOfWeek === day);
                const hasSlots = existingDay && existingDay.slots.length > 0;

                acc[day] = {
                    isAvailable: hasSlots || false,
                    startTime:
                        hasSlots && existingDay!.slots[0]
                            ? existingDay!.slots[0].start
                            : '',
                    endTime:
                        hasSlots && existingDay!.slots[0]
                            ? existingDay!.slots[0].end
                            : '',
                };
                return acc;
            },
            {} as Record<
                string,
                { isAvailable: boolean; startTime: string; endTime: string }
            >,
        ),
    );

    // Estados para la funcionalidad de horarios múltiples
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [bulkStartTime, setBulkStartTime] = useState('');
    const [bulkEndTime, setBulkEndTime] = useState('');
    const [showBulkSchedule, setShowBulkSchedule] = useState(false);
    const [copiedFromDay, setCopiedFromDay] = useState<string | null>(null);

    // Use ref to track if this is the initial render
    const isInitialRender = useRef(true);

    // Use useEffect to handle availability updates
    useEffect(() => {
        // Skip the initial render to avoid calling onChange on mount
        if (isInitialRender.current) {
            isInitialRender.current = false;
            return;
        }

        const newAvailability = daysOfWeek
            .filter((day) => dayStates[day].isAvailable)
            .map((day) => ({
                dayOfWeek: day,
                slots: [
                    {
                        start: dayStates[day].startTime,
                        end: dayStates[day].endTime,
                        timezone: 'America/Bogota', // Zona horaria de Bogotá, Colombia
                    },
                ],
            }));

        onChange(newAvailability);
    }, [dayStates]);

    const handleCheckboxChange = (day: string, checked: boolean) => {
        setDayStates((prev) => ({
            ...prev,
            [day]: {
                ...prev[day],
                isAvailable: checked,
            },
        }));
    };

    const handleTimeChange = (
        day: string,
        field: 'startTime' | 'endTime',
        value: string,
    ) => {
        setDayStates((prev) => ({
            ...prev,
            [day]: {
                ...prev[day],
                [field]: value,
            },
        }));
    };

    // Función para aplicar horarios a múltiples días
    const applyBulkSchedule = () => {
        if (selectedDays.length === 0) return;

        const updatedStates = { ...dayStates };
        selectedDays.forEach(day => {
            updatedStates[day] = {
                ...updatedStates[day],
                isAvailable: true,
                startTime: bulkStartTime,
                endTime: bulkEndTime,
            };
        });

        setDayStates(updatedStates);
        setSelectedDays([]);
        setShowBulkSchedule(false);
    };

    // Función para copiar horario de un día específico
    const copyScheduleFromDay = (sourceDay: string) => {
        if (!dayStates[sourceDay].isAvailable) return;

        const sourceSchedule = dayStates[sourceDay];
        const updatedStates = { ...dayStates };

        selectedDays.forEach(day => {
            updatedStates[day] = {
                ...updatedStates[day],
                isAvailable: true,
                startTime: sourceSchedule.startTime,
                endTime: sourceSchedule.endTime,
            };
        });

        setDayStates(updatedStates);
        setCopiedFromDay(sourceDay);
        setTimeout(() => setCopiedFromDay(null), 2000);
        setSelectedDays([]);
    };

    // Función para seleccionar/deseleccionar días para operaciones en lote
    const toggleDaySelection = (day: string) => {
        setSelectedDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day]
        );
    };

    // Función para seleccionar todos los días
    const selectAllDays = () => {
        setSelectedDays(daysOfWeek);
    };

    // Función para limpiar selección
    const clearSelection = () => {
        setSelectedDays([]);
    };

    return (
        <Card className="bg-card border-border">
            <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    ¿Cuándo podemos encontrarnos?
                </CardTitle>

                {/* Controles de selección múltiple */}
                <div className="space-y-4 pt-4 border-t border-border">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowBulkSchedule(!showBulkSchedule)}
                            className="flex items-center gap-2"
                        >
                            <Clock className="h-4 w-4" />
                            Configurar múltiples días
                        </Button>

                        {selectedDays.length > 0 && (
                            <>
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    {selectedDays.length} día{selectedDays.length > 1 ? 's' : ''} seleccionado{selectedDays.length > 1 ? 's' : ''}
                                </Badge>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearSelection}
                                >
                                    Limpiar
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Panel de configuración múltiple */}
                    {showBulkSchedule && (
                        <div className="bg-muted/30 rounded-lg p-4 space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={selectAllDays}
                                >
                                    Seleccionar todos
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={clearSelection}
                                >
                                    Deseleccionar todos
                                </Button>
                            </div>

                            {selectedDays.length > 0 && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">Hora de inicio</Label>
                                            <TimePicker
                                                value={bulkStartTime}
                                                onChange={(value) => setBulkStartTime(value)}
                                                placeholder="Seleccionar hora de inicio"
                                                maxTime={bulkEndTime}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">Hora de fin</Label>
                                            <TimePicker
                                                value={bulkEndTime}
                                                onChange={(value) => setBulkEndTime(value)}
                                                placeholder="Seleccionar hora de fin"
                                                minTime={bulkStartTime}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            onClick={applyBulkSchedule}
                                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                                        >
                                            <Check className="h-4 w-4 mr-2" />
                                            Aplicar a días seleccionados
                                        </Button>
                                    </div>

                                    {/* Opción para copiar de un día existente */}
                                    <div className="border-t border-border pt-3">
                                        <Label className="text-sm font-medium mb-2 block">
                                            O copiar horario de:
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {daysOfWeek
                                                .filter(day => dayStates[day].isAvailable)
                                                .map(day => (
                                                    <Button
                                                        key={day}
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => copyScheduleFromDay(day)}
                                                        className={`flex items-center gap-2 ${copiedFromDay === day ? 'bg-green-100 border-green-300' : ''
                                                            }`}
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                        {dayLabels[day as keyof typeof dayLabels]}
                                                        <span className="text-xs">
                                                            ({formatTime12Hour(dayStates[day].startTime)} - {formatTime12Hour(dayStates[day].endTime)})
                                                        </span>
                                                        {copiedFromDay === day && <Check className="h-3 w-3 text-green-600" />}
                                                    </Button>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {daysOfWeek.map((day) => (
                        <div
                            key={day}
                            className={`space-y-3 p-4 border rounded-lg transition-all duration-200 ${selectedDays.includes(day)
                                ? 'border-purple-300 bg-purple-50/50 dark:bg-purple-950/20'
                                : 'border-border bg-background/50'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`available-${day}`}
                                        checked={dayStates[day].isAvailable}
                                        onCheckedChange={(checked) =>
                                            handleCheckboxChange(day, !!checked)
                                        }
                                    />
                                    <Label
                                        htmlFor={`available-${day}`}
                                        className="text-sm font-medium text-foreground cursor-pointer"
                                    >
                                        {dayLabels[day as keyof typeof dayLabels]}
                                    </Label>
                                </div>

                                {/* Checkbox para selección múltiple */}
                                {showBulkSchedule && (
                                    <Checkbox
                                        checked={selectedDays.includes(day)}
                                        onCheckedChange={() => toggleDaySelection(day)}
                                        className="border-purple-400"
                                    />
                                )}
                            </div>

                            <div className="flex flex-col md:flex-row gap-4">
                                {/* Hora de inicio */}
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                        Hora de inicio
                                    </Label>
                                    <TimePicker
                                        value={dayStates[day].startTime}
                                        onChange={(value) => handleTimeChange(day, 'startTime', value)}
                                        disabled={!dayStates[day].isAvailable}
                                        placeholder="Seleccionar hora"
                                        maxTime={dayStates[day].endTime}
                                    />
                                </div>

                                {/* Hora de fin */}
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                        Hora de fin
                                    </Label>
                                    <TimePicker
                                        value={dayStates[day].endTime}
                                        onChange={(value) => handleTimeChange(day, 'endTime', value)}
                                        disabled={!dayStates[day].isAvailable || !dayStates[day].startTime}
                                        placeholder="Seleccionar hora"
                                        minTime={dayStates[day].startTime}
                                    />
                                </div>
                            </div>

                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
