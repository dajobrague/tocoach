"use client";

import { Button, Card, CardBody, Chip, CircularProgress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { getMockWorkoutPrograms } from "@/lib/mock-data/client-profile-mock";

interface WorkoutsContentProps {
  clientId: string;
  firstName: string;
  logoUrl?: string;
  trainerName: string;
  clientProfilePicture?: string;
  tenantSlug: string;
}

type SessionStatus = "completed" | "pending" | "rest" | "in-progress";

interface ScheduledSession {
  id: string;
  date: Date;
  dayLabel: string;
  sessionName: string;
  status: SessionStatus;
  exercises: any[];
  duration?: number;
  completedAt?: Date;
  progress?: number;
  dayOfWeek: string;
}

export function WorkoutsContent({
  clientId,
  firstName,
  logoUrl,
  trainerName,
  clientProfilePicture,
  tenantSlug,
}: WorkoutsContentProps) {
  const programs = getMockWorkoutPrograms(clientId);
  const activeProgram = programs.find((p) => p.status === "active");
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set()
  );
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(
    new Set()
  );

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);

    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  const toggleExercise = (exerciseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedExercises);

    if (newExpanded.has(exerciseId)) {
      newExpanded.delete(exerciseId);
    } else {
      newExpanded.add(exerciseId);
    }
    setExpandedExercises(newExpanded);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };

  const getWeekNumber = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;

    return Math.ceil(diff / oneWeek);
  };

  // Generate scheduled sessions from active program
  const getScheduledSessions = (): ScheduledSession[] => {
    if (!activeProgram) return [];

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const sessions: ScheduledSession[] = [];
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const dayMap: { [key: string]: number } = {
      Lun: 1,
      Mar: 2,
      Mié: 3,
      Jue: 4,
      Vie: 5,
      Sáb: 6,
      Dom: 0,
    };

    // Create sessions for the past week and next 2 weeks
    for (let dayOffset = -7; dayOffset <= 14; dayOffset++) {
      const sessionDate = new Date(today);

      sessionDate.setDate(today.getDate() + dayOffset);
      const dayOfWeek = dayNames[sessionDate.getDay()];

      // Find matching session for this day
      const matchingSession = activeProgram.sessions.find(
        (s) => dayOfWeek && s.dayOfWeek.startsWith(dayOfWeek.substring(0, 3))
      );

      if (matchingSession) {
        // Use deterministic values based on dayOffset to avoid hydration errors
        const seed = Math.abs(dayOffset);
        let status: SessionStatus = "pending";
        let progress = 0;

        if (dayOffset < 0) {
          // Past sessions - mostly completed
          status = seed % 5 === 0 ? "pending" : "completed";
          progress = status === "completed" ? 100 : 0;
        } else if (dayOffset === 0) {
          // Today - could be in progress or pending
          status = seed % 2 === 0 ? "pending" : "in-progress";
          progress = status === "in-progress" ? 45 : 0;
        }

        let dayLabel = "";

        if (dayOffset === 0) dayLabel = "Hoy";
        else if (dayOffset === -1) dayLabel = "Ayer";
        else if (dayOffset === 1) dayLabel = "Mañana";
        else dayLabel = dayOfWeek || "";

        // Fixed duration based on session to avoid hydration mismatch
        const durationMinutes = 50 + seed * 5;

        const sessionData: any = {
          id: `${matchingSession.id}-${dayOffset}`,
          date: sessionDate,
          dayLabel,
          sessionName: matchingSession.name,
          status,
          exercises: matchingSession.exercises,
          duration: durationMinutes,
          progress,
          dayOfWeek: dayOfWeek || "",
        };

        if (status === "completed") {
          sessionData.completedAt = new Date(
            sessionDate.getTime() + 2 * 60 * 60 * 1000
          );
        }

        sessions.push(sessionData);
      }
    }

    return sessions.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const scheduledSessions = getScheduledSessions();
  const todaySession = scheduledSessions.find((s) => s.dayLabel === "Hoy");
  const tomorrowSession = scheduledSessions.find(
    (s) => s.dayLabel === "Mañana"
  );
  const yesterdaySession = scheduledSessions.find((s) => s.dayLabel === "Ayer");
  const upcomingSessions = scheduledSessions
    .filter((s) => s.date > new Date() && s.dayLabel !== "Mañana")
    .slice(0, 7);
  const pastSessions = scheduledSessions
    .filter((s) => s.date < new Date() && s.dayLabel !== "Ayer")
    .reverse()
    .slice(0, 7);

  const getStatusBadge = (status: SessionStatus) => {
    const config = {
      completed: {
        color: "success",
        icon: "solar:check-circle-bold",
        text: "Completado",
      },
      "in-progress": {
        color: "warning",
        icon: "solar:clock-circle-bold",
        text: "En Progreso",
      },
      pending: {
        color: "default",
        icon: "solar:calendar-bold",
        text: "Pendiente",
      },
      rest: {
        color: "secondary",
        icon: "solar:sleeping-bold",
        text: "Descanso",
      },
    };
    const { color, icon, text } = config[status];

    return (
      <Chip
        classNames={{ content: "font-semibold" }}
        color={color as any}
        size="sm"
        startContent={<Icon icon={icon} width={14} />}
        variant="flat"
      >
        {text}
      </Chip>
    );
  };

  const renderSessionCard = (
    session: ScheduledSession,
    isToday: boolean = false
  ) => {
    const isExpanded = expandedSessions.has(session.id);

    return (
      <Card
        key={session.id}
        className={`${isToday ? "bg-primary border-2 border-primary shadow-lg" : "bg-content1 border border-default-200"} transition-all w-full`}
      >
        <CardBody className={isToday ? "p-5" : "p-4"}>
          <button
            className="flex items-start justify-between gap-3 w-full cursor-pointer text-left border-0 bg-transparent p-0"
            onClick={() => toggleSession(session.id)}
          >
            {/* Date Badge */}
            <div
              className={`flex flex-col items-center justify-center ${isToday ? "bg-white/20" : "bg-default-100"} rounded-xl ${isToday ? "w-16 h-16" : "w-14 h-14"} flex-shrink-0`}
            >
              <span
                className={`text-xs font-semibold ${isToday ? "text-white" : "text-foreground/60"} font-body`}
              >
                {session.dayLabel === "Hoy" ||
                session.dayLabel === "Ayer" ||
                session.dayLabel === "Mañana"
                  ? session.dayLabel
                  : session.dayOfWeek}
              </span>
              <span
                className={`text-lg font-bold ${isToday ? "text-white" : "text-foreground"} font-heading`}
              >
                {session.date.getDate()}
              </span>
            </div>

            {/* Session Info */}
            <div className="flex-1 min-w-0">
              <h3
                className={`${isToday ? "text-xl" : "text-base"} font-heading font-bold ${isToday ? "text-white" : "text-foreground"} mb-1`}
              >
                {session.sessionName}
              </h3>
              <p
                className={`text-sm ${isToday ? "text-white/80" : "text-foreground/60"} font-body mb-2`}
              >
                {session.exercises.length} ejercicios • {session.duration} min
              </p>
              {isToday ? (
                <Chip
                  className="bg-white/20 border border-white/30"
                  classNames={{ content: "text-white font-semibold" }}
                  size="sm"
                  startContent={
                    <Icon
                      className="text-white"
                      icon="solar:clock-circle-bold"
                      width={14}
                    />
                  }
                  variant="flat"
                >
                  {session.status === "completed"
                    ? "Completado"
                    : session.status === "in-progress"
                      ? "En Progreso"
                      : "Pendiente"}
                </Chip>
              ) : (
                getStatusBadge(session.status)
              )}
            </div>

            {/* Progress or Arrow */}
            <div className="flex-shrink-0">
              {session.status === "in-progress" &&
              session.progress &&
              isToday ? (
                <CircularProgress
                  showValueLabel
                  classNames={{
                    svg: "w-12 h-12",
                    value: "text-xs font-semibold text-white",
                    track: "stroke-white/20",
                    indicator: "stroke-white",
                  }}
                  color="default"
                  size="lg"
                  value={session.progress}
                />
              ) : session.status === "in-progress" &&
                session.progress &&
                !isToday ? (
                <CircularProgress
                  showValueLabel
                  classNames={{
                    svg: "w-12 h-12",
                    value: "text-xs font-semibold text-foreground",
                  }}
                  color="primary"
                  size="lg"
                  value={session.progress}
                />
              ) : (
                <Icon
                  className={isToday ? "text-white/60" : "text-foreground/40"}
                  icon={
                    isExpanded
                      ? "solar:alt-arrow-up-linear"
                      : "solar:alt-arrow-down-linear"
                  }
                  width={20}
                />
              )}
            </div>
          </button>

          {/* CTA Button for Today */}
          {isToday && !isExpanded && (
            <Button
              className="w-full mt-4 font-semibold bg-white/20 text-white border border-white/30"
              color="default"
              size="lg"
              startContent={
                <Icon
                  icon={
                    session.status === "in-progress"
                      ? "solar:play-bold"
                      : "solar:play-circle-bold"
                  }
                  width={20}
                />
              }
              variant="flat"
              onPress={(e: any) => {
                e?.stopPropagation?.();
                // Handle start workout action here
              }}
            >
              {session.status === "in-progress"
                ? "Continuar Entrenamiento"
                : "Comenzar Entrenamiento"}
            </Button>
          )}

          {/* Expanded Exercise List */}
          {isExpanded && (
            <div
              className={`mt-4 pt-4 ${isToday ? "border-t border-white/20" : "border-t border-default-200"} space-y-3`}
            >
              {session.exercises.map((exercise) => {
                const exerciseId = `${session.id}-${exercise.order}`;
                const isExerciseExpanded = expandedExercises.has(exerciseId);

                return (
                  <button
                    key={exercise.order}
                    className={`p-3 ${isToday ? "bg-white/10 border border-white/20" : "bg-default-50"} rounded-lg cursor-pointer hover:${isToday ? "bg-white/15" : "bg-default-100"} transition-colors text-left w-full`}
                    onClick={(e) => toggleExercise(exerciseId, e)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Exercise Number Badge */}
                      <div
                        className={`w-7 h-7 ${isToday ? "bg-white" : "bg-primary"} rounded-full flex items-center justify-center flex-shrink-0`}
                      >
                        <span
                          className={`text-xs font-bold ${isToday ? "text-primary" : "text-white"}`}
                        >
                          {exercise.order}
                        </span>
                      </div>

                      {/* Exercise Info - Fixed Layout */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p
                            className={`text-sm font-bold ${isToday ? "text-white" : "text-foreground"} font-heading flex-1 min-w-0`}
                          >
                            {exercise.name}
                          </p>
                          {/* Video Button - Fixed Position */}
                          {exercise.videoUrl && (
                            <Button
                              isIconOnly
                              as="a"
                              className={`h-7 w-7 min-w-7 flex-shrink-0 ${isToday ? "bg-white/20" : ""}`}
                              href={exercise.videoUrl}
                              size="sm"
                              target="_blank"
                              variant="flat"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Icon
                                className={
                                  isToday ? "text-white" : "text-primary"
                                }
                                icon="solar:play-circle-bold"
                                width={16}
                              />
                            </Button>
                          )}
                        </div>

                        {/* Basic Stats - Always Visible */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Icon
                              className={
                                isToday ? "text-white/60" : "text-foreground/40"
                              }
                              icon="solar:copy-bold"
                              width={12}
                            />
                            <span
                              className={`${isToday ? "text-white/80" : "text-foreground/60"} font-body`}
                            >
                              <span
                                className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                              >
                                {exercise.sets}
                              </span>{" "}
                              series
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Icon
                              className={
                                isToday ? "text-white/60" : "text-foreground/40"
                              }
                              icon="solar:hashtag-bold"
                              width={12}
                            />
                            <span
                              className={`${isToday ? "text-white/80" : "text-foreground/60"} font-body`}
                            >
                              <span
                                className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                              >
                                {exercise.reps}
                              </span>{" "}
                              reps
                            </span>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExerciseExpanded && (
                          <div
                            className={`mt-3 pt-3 ${isToday ? "border-t border-white/10" : "border-t border-default-200"} space-y-2`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon
                                className={
                                  isToday ? "text-white/60" : "text-primary"
                                }
                                icon="solar:graph-bold"
                                width={14}
                              />
                              <span
                                className={`text-xs ${isToday ? "text-white/80" : "text-foreground/60"} font-body`}
                              >
                                Sistema:{" "}
                                <span
                                  className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                                >
                                  {exercise.trainingSystem}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Icon
                                className={
                                  isToday ? "text-white/60" : "text-secondary"
                                }
                                icon="solar:speedometer-bold"
                                width={14}
                              />
                              <span
                                className={`text-xs ${isToday ? "text-white/80" : "text-foreground/60"} font-body`}
                              >
                                Tempo:{" "}
                                <span
                                  className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                                >
                                  {exercise.tempo}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Icon
                                className={
                                  isToday ? "text-white/60" : "text-warning"
                                }
                                icon="solar:clock-circle-bold"
                                width={14}
                              />
                              <span
                                className={`text-xs ${isToday ? "text-white/80" : "text-foreground/60"} font-body`}
                              >
                                Descanso:{" "}
                                <span
                                  className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                                >
                                  {exercise.rest}
                                </span>
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Expand Indicator */}
                        <div className="flex items-center justify-center mt-2">
                          <Icon
                            className={`${isToday ? "text-white/40" : "text-foreground/30"} text-sm`}
                            icon={
                              isExerciseExpanded
                                ? "solar:alt-arrow-up-linear"
                                : "solar:alt-arrow-down-linear"
                            }
                            width={16}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // Mock streak data
  const currentStreak = 0;

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto">
          {/* Top Header - Same as Dashboard */}
          <ClientHeader
            clientId={clientId}
            clientProfilePicture={clientProfilePicture}
            currentStreak={currentStreak}
            firstName={firstName}
            logoUrl={logoUrl}
            showStreak={currentStreak >= 2}
            tenantSlug={tenantSlug}
            trainerName={trainerName}
          />

          <div className="px-4 space-y-6 w-full">
            {/* Today's Training - Most Prominent */}
            {todaySession && (
              <div className="w-full">
                <div className="flex items-center gap-2 mb-3">
                  <Icon
                    className="text-primary"
                    icon="solar:calendar-bold"
                    width={20}
                  />
                  <h2 className="text-xl font-heading font-semibold text-foreground">
                    Hoy
                  </h2>
                </div>
                {renderSessionCard(todaySession, true)}
              </div>
            )}

            {/* Tomorrow's Training */}
            {tomorrowSession && (
              <div className="w-full">
                <div className="flex items-center gap-2 mb-3 mt-8">
                  <Icon
                    className="text-foreground/70"
                    icon="solar:calendar-bold"
                    width={18}
                  />
                  <h3 className="text-lg font-heading font-semibold text-foreground">
                    Mañana
                  </h3>
                </div>
                {renderSessionCard(tomorrowSession)}
              </div>
            )}

            {/* Yesterday's Training */}
            {yesterdaySession && (
              <div className="w-full">
                <div className="flex items-center gap-2 mb-3 mt-8">
                  <Icon
                    className="text-foreground/70"
                    icon="solar:history-bold"
                    width={18}
                  />
                  <h3 className="text-lg font-heading font-semibold text-foreground">
                    Ayer
                  </h3>
                </div>
                {renderSessionCard(yesterdaySession)}
              </div>
            )}

            {/* Upcoming Sessions */}
            {upcomingSessions.length > 0 && (
              <div className="w-full">
                <div className="flex items-center gap-2 mb-3 mt-8">
                  <Icon
                    className="text-foreground/70"
                    icon="solar:calendar-add-bold"
                    width={18}
                  />
                  <h3 className="text-lg font-heading font-semibold text-foreground">
                    Próximos Entrenamientos
                  </h3>
                </div>
                <div className="space-y-3 w-full">
                  {upcomingSessions.map((session) =>
                    renderSessionCard(session)
                  )}
                </div>
              </div>
            )}

            {/* Past Sessions */}
            {pastSessions.length > 0 && (
              <div className="w-full">
                <div className="flex items-center gap-2 mb-3 mt-8">
                  <Icon
                    className="text-foreground/70"
                    icon="solar:history-2-bold"
                    width={18}
                  />
                  <h3 className="text-lg font-heading font-semibold text-foreground">
                    Entrenamientos Pasados
                  </h3>
                </div>
                <div className="space-y-3 w-full">
                  {pastSessions
                    .slice(0, 5)
                    .map((session) => renderSessionCard(session))}
                </div>
              </div>
            )}

            {/* No Active Program State */}
            {!activeProgram && (
              <Card className="bg-content1 border border-default-200 shadow-sm">
                <CardBody className="p-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="bg-default-100 p-4 rounded-full mb-4">
                      <Icon
                        className="text-foreground/40 text-5xl"
                        icon="solar:dumbbell-linear"
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground font-heading mb-2">
                      No tienes un programa activo
                    </h3>
                    <p className="text-foreground/60 text-sm font-body">
                      Tu entrenador asignará un programa pronto
                    </p>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}
