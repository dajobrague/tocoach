"use client";

import type { WorkoutProgram } from "@/types/training";

import {
  Button,
  Card,
  CardBody,
  Chip,
  CircularProgress,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { ExerciseLogModal } from "@/components/client-dashboard/exercise-log-modal";
import { RescheduleModal } from "@/components/client-dashboard/reschedule-modal";
import {
  VerticalVideoPlayerModal,
  type VerticalVideoPlayerHandle,
} from "@/components/client-dashboard/vertical-video-player-modal";
import { VideoPlayerModal } from "@/components/client-dashboard/video-player-modal";
import {
  useExerciseLogs,
  usePrograms,
  useScheduledSessions,
} from "@/lib/hooks/use-client-queries";
import { sessionCalendarDayMatches } from "@/lib/utils/training-utils";

type SessionStatus = "completed" | "pending" | "rest" | "in-progress";

interface ScheduledSession {
  id: string;
  sessionId: string; // Original session ID from database
  /** Row id from `scheduled_sessions` if one exists for this slot; null
   * when the slot is purely template-driven and has never been touched. */
  scheduledSessionId: string | null;
  /** Server-format YYYY-MM-DD string for this slot. Used as the
   * `scheduledDate` field when creating a `scheduled_sessions` row from the
   * "Marcar como completado" action so the new row lines up with any
   * exercise logs that already reference this date. */
  scheduledDateStr: string;
  date: Date;
  dayLabel: string;
  sessionName: string;
  status: SessionStatus;
  /** True only when `scheduled_sessions.status === 'completed'` (i.e. set by
   * an explicit user action, not derived from logs). Drives the "Marcar
   * como pendiente" item in the dropdown — we never expose that for sessions
   * whose `completed` came from logs because re-rendering would just
   * derive it back to `completed` and the user would see no effect. */
  isExplicitlyCompleted: boolean;
  exercises: any[];
  duration?: number;
  completedAt?: Date;
  progress?: number;
  dayOfWeek: string;
}

export function WorkoutsContent() {
  const {
    clientId,
    firstName,
    logoUrl,
    trainerName,
    clientProfilePicture,
    tenantSlug,
  } = useClientData();
  // ─── TanStack Query: cached data, no content flash on refetch ───────────
  const queryClient = useQueryClient();

  const {
    data: programs = [],
    isLoading: isLoadingPrograms,
    error: programsError,
    refetch: refetchPrograms,
  } = usePrograms();
  const { data: exerciseLogs = [] } = useExerciseLogs(clientId);
  const { data: scheduledSessionsData = [] } = useScheduledSessions(clientId);

  const isLoading = isLoadingPrograms;
  const error = programsError ? (programsError as Error).message : null;
  const activePrograms = programs.filter(
    (p: WorkoutProgram) => p.status === "active"
  );

  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set()
  );
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(
    new Set()
  );

  // Modal states
  const [isExerciseLogModalOpen, setIsExerciseLogModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const verticalPlayerRef = useRef<VerticalVideoPlayerHandle>(null);

  // Selected items for modals
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [selectedRescheduleSession, setSelectedRescheduleSession] =
    useState<any>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState("");
  const [selectedVideoExerciseName, setSelectedVideoExerciseName] =
    useState("");
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [selectedImageExerciseName, setSelectedImageExerciseName] =
    useState("");

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

  // Check if an exercise is logged for a specific date
  const isExerciseLogged = (exerciseId: string, date: string): boolean => {
    if (!exerciseId || !date) return false;

    return exerciseLogs.some(
      (log: any) =>
        log.exercise_id === exerciseId && log.scheduled_date === date
    );
  };

  // Get exercise log for a specific exercise and date
  const getExerciseLog = (
    exerciseId: string,
    date: string
  ): any | undefined => {
    if (!exerciseId || !date) return undefined;

    return exerciseLogs.find(
      (log: any) =>
        log.exercise_id === exerciseId && log.scheduled_date === date
    );
  };

  // Handle exercise log modal
  const handleOpenExerciseLog = (
    exercise: any,
    sessionId: string,
    scheduledDate: string,
    existingLog?: any
  ) => {
    if (!exercise.exercise_id) {
      console.error(
        "[WorkoutsContent] Cannot log exercise without exercise_id"
      );

      return;
    }
    setSelectedExercise({
      ...exercise,
      sessionId,
      scheduledDate,
      existingLog: existingLog || null,
    });
    setIsExerciseLogModalOpen(true);
  };

  // Handle reschedule modal
  const handleOpenReschedule = (session: any) => {
    setSelectedRescheduleSession({
      sessionName: session.sessionName,
      currentDate: session.date.toISOString().split("T")[0],
      scheduledSessionId: session.scheduledSessionId ?? null,
      sessionId: session.sessionId,
    });
    setIsRescheduleModalOpen(true);
  };

  // Handle video modal
  const handleOpenVideo = (videoUrl: string, exerciseName: string) => {
    setSelectedVideoUrl(videoUrl);
    setSelectedVideoExerciseName(exerciseName);
    setIsVideoModalOpen(true);
  };

  const handleOpenVerticalVideo = (videoUrl: string, exerciseName: string) => {
    verticalPlayerRef.current?.open(videoUrl, exerciseName);
  };

  // Handle image modal
  const handleOpenImage = (imageUrl: string, exerciseName: string) => {
    setSelectedImageUrl(imageUrl);
    setSelectedImageExerciseName(exerciseName);
    setIsImageModalOpen(true);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };

  // ── Manual session-completion mutation ──────────────────────────────────
  //
  // Some workouts can never be marked "completed" via the derived logic —
  // typically those composed entirely of free-text exercises (no
  // `exercise_id` to log against). For those, and as an explicit override
  // for any session, the user can mark the session as done from the dropdown.
  //
  // Why two endpoints: `scheduled_sessions` rows are created lazily — only
  // when the user reschedules or logs an exercise. A "fresh" template slot
  // therefore has no row to PUT into. We POST first to create one with
  // `status: "completed"`, otherwise we PUT the existing row.
  const [pendingCompletionId, setPendingCompletionId] = useState<string | null>(
    null
  );

  const refreshSessionsAfterStatusChange = () => {
    queryClient.invalidateQueries({
      queryKey: ["client", "scheduledSessions", clientId],
    });
    queryClient.invalidateQueries({
      queryKey: ["client", "exerciseLogs", clientId],
    });
  };

  const setSessionStatus = async (
    session: any,
    nextStatus: "completed" | "scheduled"
  ) => {
    if (!clientId) return;
    setPendingCompletionId(session.id);
    try {
      // We deliberately do NOT send `completedAt`. The `scheduled_sessions`
      // table currently has no `completed_at` column in production, but the
      // PUT endpoint at `app/api/clients/[clientId]/scheduled-sessions/[sessionId]/route.ts`
      // still tries to write to it whenever the field is present, which makes
      // PostgREST reject the entire UPDATE with PGRST204 and the user's
      // status change silently fails (Railway logs 30 abr 15:32+).
      // The status flag alone is enough for the derived/persisted-status
      // logic in `buildCard` to decide whether the session is completed.
      if (session.scheduledSessionId) {
        const res = await fetch(
          `/api/clients/${clientId}/scheduled-sessions/${session.scheduledSessionId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          }
        );
        const data = await res.json();

        if (!data.success) {
          console.error("[Workouts] Mark session status PUT failed:", data);
        }
      } else {
        // No scheduled_sessions row yet — create one with the desired status.
        // Only "completed" makes sense as an initial state from this UI; we
        // don't expose creating a "scheduled" row out of nowhere.
        if (nextStatus !== "completed") return;

        const res = await fetch(`/api/clients/${clientId}/scheduled-sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.sessionId,
            scheduledDate: session.scheduledDateStr,
            status: "completed",
          }),
        });
        const data = await res.json();

        if (!data.success) {
          console.error("[Workouts] Mark session status POST failed:", data);

          return;
        }
      }
      refreshSessionsAfterStatusChange();
    } catch (err) {
      console.error("[Workouts] Mark session status error:", err);
    } finally {
      setPendingCompletionId(null);
    }
  };

  const handleMarkAsCompleted = (session: any) =>
    setSessionStatus(session, "completed");
  const handleMarkAsPending = (session: any) =>
    setSessionStatus(session, "scheduled");

  const getWeekNumber = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;

    return Math.ceil(diff / oneWeek);
  };

  // Generate scheduled sessions from ALL active programs, merging with
  // rescheduled rows from scheduled_sessions so moved workouts appear on
  // the correct date and vanish from the original template slot.
  const getScheduledSessions = (): ScheduledSession[] => {
    if (!activePrograms || activePrograms.length === 0) return [];

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const sessions: ScheduledSession[] = [];
    const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

    // Template slots that were rescheduled away — keyed as "sessionId::YYYY-MM-DD"
    const rescheduledAwaySlots = new Set<string>();

    for (const ss of scheduledSessionsData as any[]) {
      const origDate = ss.metadata?.original_plan_date;

      if (origDate && ss.session_id) {
        rescheduledAwaySlots.add(`${ss.session_id}::${origDate}`);
      }
    }

    // Track slots the template loop already covers so the injection pass
    // only adds truly missing entries.
    const coveredSlots = new Set<string>();

    // Lookup: session_id → program session (for the injection pass)
    const sessionLookup = new Map<string, any>();

    for (const prog of activePrograms) {
      for (const s of (prog as any).sessions) {
        sessionLookup.set(s.id, s);
      }
    }

    // Shared helper: compute status & progress for a session on a given date.
    //
    // Status resolution order (most authoritative first):
    //   1. Explicit persisted status in `scheduled_sessions.status === 'completed'`
    //      — set by the user via "Marcar como completado". This wins because it's
    //      a direct user statement; we never want to demote it back to derived.
    //   2. Derived status from logged exercises — counts library-linked exercises
    //      (those with `exercise_id`) as the denominator. Sessions composed
    //      entirely of free-text exercises (no `exercise_id` to log against)
    //      stay "pending" until the user marks them complete manually — that's
    //      a concession we make because there is no log row to count.
    const buildCard = (
      templateSession: any,
      sessionDate: Date,
      dayOffset: number,
      dateStr: string,
      dayOfWeek: string,
      realScheduled: any | null
    ) => {
      const exercises: any[] = templateSession.exercises || [];
      const trackableExercises = exercises
        .map((e: any, idx: number) => ({
          eid: e.exercise_id || null,
          slot: idx,
        }))
        .filter((e) => e.eid);
      const totalExercises = trackableExercises.length;

      const loggedSet = new Set(
        exerciseLogs
          .filter((log: any) => log.scheduled_date === dateStr)
          .map((log: any) => log.exercise_id)
      );
      const loggedCount = trackableExercises.filter((e) =>
        loggedSet.has(e.eid)
      ).length;

      const persistedStatus =
        typeof realScheduled?.status === "string"
          ? (realScheduled.status as string).toLowerCase()
          : null;
      const isExplicitlyCompleted = persistedStatus === "completed";

      let status: SessionStatus = "pending";
      let progress = 0;

      if (isExplicitlyCompleted) {
        // User said it's done. Trust it — even if logs are missing or the
        // session is in the future (rare but legal: e.g. they completed an
        // alternate workout earlier and want this slot off the queue).
        status = "completed";
        progress = 100;
      } else if (dayOffset > 0) {
        status = "pending";
      } else if (totalExercises > 0 && loggedCount > 0) {
        if (loggedCount >= totalExercises) {
          status = "completed";
          progress = 100;
        } else {
          status = "in-progress";
          progress = Math.round((loggedCount / totalExercises) * 100);
        }
      }

      let dayLabel = "";

      if (dayOffset === 0) dayLabel = "Hoy";
      else if (dayOffset === -1) dayLabel = "Ayer";
      else if (dayOffset === 1) dayLabel = "Mañana";
      else dayLabel = dayOfWeek || "";

      const sessionData: any = {
        id: `${templateSession.id}-${dayOffset}`,
        sessionId: templateSession.id,
        scheduledSessionId: realScheduled?.id ?? null,
        date: sessionDate,
        dayLabel,
        sessionName: templateSession.name,
        status,
        exercises: templateSession.exercises,
        progress,
        dayOfWeek: dayOfWeek || "",
        // Carry the persisted-status flag so the UI can show "Marcar como
        // pendiente" only on sessions that are completed via explicit user
        // action (not via derived logs).
        isExplicitlyCompleted,
        scheduledDateStr: dateStr,
      };

      if (status === "completed") {
        sessionData.completedAt = realScheduled?.completed_at
          ? new Date(realScheduled.completed_at)
          : new Date(sessionDate.getTime() + 2 * 60 * 60 * 1000);
      }

      return sessionData;
    };

    // ── Pass 1: template-driven slots ────────────────────────────────────
    for (let dayOffset = -14; dayOffset <= 21; dayOffset++) {
      const sessionDate = new Date(today);

      sessionDate.setDate(today.getDate() + dayOffset);
      const dayOfWeek = dayNames[sessionDate.getDay()] ?? "";

      for (const activeProgram of activePrograms) {
        const matchingSession = (activeProgram as any).sessions.find(
          (s: any) =>
            dayOfWeek &&
            Array.isArray(s.dayOfWeek) &&
            s.dayOfWeek.length > 0 &&
            s.dayOfWeek.some((d: unknown) =>
              sessionCalendarDayMatches(dayOfWeek, d)
            )
        );

        if (matchingSession) {
          const dateStr = sessionDate.toISOString().slice(0, 10);

          // If this slot was rescheduled to another date, skip it
          if (rescheduledAwaySlots.has(`${matchingSession.id}::${dateStr}`)) {
            continue;
          }

          coveredSlots.add(`${matchingSession.id}::${dateStr}`);

          const realScheduled = (scheduledSessionsData as any[]).find(
            (ss: any) =>
              ss.session_id === matchingSession.id &&
              ss.scheduled_date === dateStr
          );

          sessions.push(
            buildCard(
              matchingSession,
              sessionDate,
              dayOffset,
              dateStr,
              dayOfWeek,
              realScheduled ?? null
            )
          );
        }
      }
    }

    // ── Pass 2: inject rescheduled sessions that landed on non-template days ─
    for (const ss of scheduledSessionsData as any[]) {
      if (!ss.session_id || !ss.scheduled_date) continue;
      if (!ss.metadata?.original_plan_date) continue;

      const slotKey = `${ss.session_id}::${ss.scheduled_date}`;

      if (coveredSlots.has(slotKey)) continue;

      const templateSession = sessionLookup.get(ss.session_id);

      if (!templateSession) continue;

      const sessionDate = new Date(ss.scheduled_date + "T00:00:00");
      const dayDiff = Math.round(
        (sessionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      const dayOfWeek = dayNames[sessionDate.getDay()] || "";

      sessions.push(
        buildCard(
          templateSession,
          sessionDate,
          dayDiff,
          ss.scheduled_date,
          dayOfWeek,
          ss
        )
      );
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
    .slice(0, 21);
  const pastSessions = scheduledSessions
    .filter((s) => s.date < new Date() && s.dayLabel !== "Ayer")
    .reverse()
    .slice(0, 14);

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
          <div
            className="flex items-start justify-between gap-3 w-full cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => toggleSession(session.id)}
            onKeyDown={(e) => e.key === "Enter" && toggleSession(session.id)}
          >
            {/* Date Badge with Icon */}
            <div
              className={`flex flex-col items-center justify-center ${isToday ? "bg-white/20" : "bg-default-100"} rounded-xl ${isToday ? "w-16 h-22" : "w-16 h-20"} flex-shrink-0 py-2`}
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
              {/* Icon badge - Cardio or Strength */}
              <Icon
                className={`${isToday ? "text-white" : "text-primary"} mt-1`}
                icon={
                  session.exercises.some((ex: any) => ex.category === "cardio")
                    ? "solar:heart-pulse-bold"
                    : "solar:dumbbell-bold"
                }
                width={22}
              />
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
                {session.exercises.length} ejercicios
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
            <div className="flex items-center gap-2 flex-shrink-0">
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

              {/* Session Actions Menu.
                  Items are conditional on the session's relative date and
                  current status:
                    – "Reprogramar" → today or future
                    – "Marcar como completado" → today or past, not already
                      completed (works even for sessions that can never be
                      auto-completed via logs, e.g. all-free-text routines)
                      – "Marcar como pendiente" → only for sessions explicitly
                      marked complete by the user (we don't allow demoting a
                      session whose `completed` status came from logs because
                      the next render would just re-derive it back to
                      `completed` and the user would think nothing happened) */}
              {(() => {
                const now = new Date();

                now.setHours(0, 0, 0, 0);
                const isFutureOrToday = session.date >= now;
                const isTodayOrPast = session.date <= now || isToday;
                const canReschedule = isFutureOrToday;
                const canMarkCompleted =
                  isTodayOrPast && session.status !== "completed";
                const canMarkPending = session.isExplicitlyCompleted === true;

                if (!canReschedule && !canMarkCompleted && !canMarkPending) {
                  return null;
                }

                const items: React.ReactElement[] = [];

                if (canReschedule) {
                  items.push(
                    <DropdownItem
                      key="reschedule"
                      startContent={
                        <Icon icon="solar:calendar-mark-linear" width={18} />
                      }
                      onPress={() => handleOpenReschedule(session)}
                    >
                      Reprogramar
                    </DropdownItem>
                  );
                }

                if (canMarkCompleted) {
                  items.push(
                    <DropdownItem
                      key="mark-completed"
                      startContent={
                        <Icon icon="solar:check-circle-bold" width={18} />
                      }
                      onPress={() => handleMarkAsCompleted(session)}
                    >
                      Marcar como completado
                    </DropdownItem>
                  );
                }

                if (canMarkPending) {
                  items.push(
                    <DropdownItem
                      key="mark-pending"
                      startContent={
                        <Icon icon="solar:undo-left-round-linear" width={18} />
                      }
                      onPress={() => handleMarkAsPending(session)}
                    >
                      Marcar como pendiente
                    </DropdownItem>
                  );
                }

                return (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Dropdown placement="bottom-end">
                      <DropdownTrigger>
                        <Button
                          isIconOnly
                          className={
                            isToday
                              ? "text-white bg-transparent hover:bg-white/10 data-[hover=true]:bg-white/10"
                              : "text-foreground"
                          }
                          isDisabled={pendingCompletionId === session.id}
                          size="sm"
                          variant="light"
                        >
                          <Icon icon="solar:menu-dots-bold" width={20} />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Session actions">
                        {items}
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Expanded Exercise List */}
          {isExpanded && (
            <div
              className={`mt-4 pt-4 ${isToday ? "border-t border-white/20" : "border-t border-default-200"} space-y-3`}
            >
              {session.exercises.map((exercise) => {
                const exerciseId = `${session.id}-${exercise.order}`;
                const isExerciseExpanded = expandedExercises.has(exerciseId);

                return (
                  <div
                    key={exercise.order}
                    className={`p-3 ${isToday ? "bg-white/10 border border-white/20" : "bg-default-50"} rounded-lg hover:${isToday ? "bg-white/15" : "bg-default-100"} transition-colors w-full`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Exercise Thumbnail or Number Badge */}
                      {exercise.imageUrl ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 relative">
                          <img
                            alt={exercise.name}
                            className="w-full h-full object-cover"
                            src={exercise.imageUrl}
                          />
                          <div
                            className={`absolute bottom-0 right-0 w-4 h-4 ${isToday ? "bg-white" : exercise.category === "cardio" ? "bg-red-500" : "bg-primary"} rounded-tl-md flex items-center justify-center`}
                          >
                            {exercise.category === "cardio" ? (
                              <Icon
                                className={
                                  isToday ? "text-primary" : "text-white"
                                }
                                icon="solar:heart-pulse-bold"
                                width={10}
                              />
                            ) : (
                              <span
                                className={`text-[8px] font-bold ${isToday ? "text-primary" : "text-white"}`}
                              >
                                {exercise.order}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`w-7 h-7 ${isToday ? "bg-white" : exercise.category === "cardio" ? "bg-red-500" : "bg-primary"} rounded-full flex items-center justify-center flex-shrink-0`}
                        >
                          {exercise.category === "cardio" ? (
                            <Icon
                              className={
                                isToday ? "text-red-500" : "text-white"
                              }
                              icon="solar:heart-pulse-bold"
                              width={14}
                            />
                          ) : (
                            <span
                              className={`text-xs font-bold ${isToday ? "text-primary" : "text-white"}`}
                            >
                              {exercise.order}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Exercise Info - Fixed Layout */}
                      <div className="flex-1 min-w-0">
                        <div
                          className="w-full cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExercise(exerciseId, e);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p
                              className={`text-sm font-bold ${isToday ? "text-white" : "text-foreground"} font-heading flex-1 min-w-0`}
                            >
                              {exercise.name}
                            </p>
                          </div>

                          {/* Basic Stats - Always Visible */}
                          {exercise.category === "cardio" ? (
                            // Cardio exercise rendering
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {exercise.duration && (
                                <div className="flex items-center gap-1">
                                  <Icon
                                    className={
                                      isToday
                                        ? "text-white/60"
                                        : "text-blue-500"
                                    }
                                    icon="solar:clock-circle-bold"
                                    width={12}
                                  />
                                  <span
                                    className={`${isToday ? "text-white/80" : "text-foreground/60"} font-body`}
                                  >
                                    <span
                                      className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                                    >
                                      {exercise.duration}
                                    </span>{" "}
                                    min
                                  </span>
                                </div>
                              )}
                              {exercise.distance && (
                                <div className="flex items-center gap-1">
                                  <Icon
                                    className={
                                      isToday
                                        ? "text-white/60"
                                        : "text-purple-500"
                                    }
                                    icon="solar:route-bold"
                                    width={12}
                                  />
                                  <span
                                    className={`${isToday ? "text-white/80" : "text-foreground/60"} font-body`}
                                  >
                                    <span
                                      className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                                    >
                                      {exercise.distance}
                                    </span>{" "}
                                    km
                                  </span>
                                </div>
                              )}
                              {exercise.intensity && (
                                <div className="flex items-center gap-1">
                                  <Icon
                                    className={
                                      isToday
                                        ? "text-white/60"
                                        : "text-orange-500"
                                    }
                                    icon="solar:fire-bold"
                                    width={12}
                                  />
                                  <span
                                    className={`${isToday ? "text-white/80" : "text-foreground/60"} font-body`}
                                  >
                                    <span
                                      className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                                    >
                                      {exercise.intensity}
                                    </span>
                                  </span>
                                </div>
                              )}
                              {exercise.heartRateZone && (
                                <div className="flex items-center gap-1">
                                  <Icon
                                    className={
                                      isToday ? "text-white/60" : "text-red-500"
                                    }
                                    icon="solar:heart-pulse-bold"
                                    width={12}
                                  />
                                  <span
                                    className={`${isToday ? "text-white/80" : "text-foreground/60"} font-body text-xs`}
                                  >
                                    {exercise.heartRateZone.min}-
                                    {exercise.heartRateZone.max} bpm
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              {/* Strength: series/reps + coaching (always visible) */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-1">
                                  <Icon
                                    className={
                                      isToday
                                        ? "text-white/60"
                                        : "text-foreground/40"
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
                                      isToday
                                        ? "text-white/60"
                                        : "text-foreground/40"
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
                              {(exercise.trainingSystem ||
                                exercise.tempo ||
                                exercise.rest ||
                                exercise.notes) && (
                                <div
                                  className={`mt-2 space-y-1 text-xs ${isToday ? "text-white/85" : "text-foreground/70"} font-body`}
                                >
                                  {exercise.trainingSystem ? (
                                    <p>
                                      <span
                                        className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                                      >
                                        Sistema:{" "}
                                      </span>
                                      {exercise.trainingSystem}
                                    </p>
                                  ) : null}
                                  {exercise.tempo ? (
                                    <p>
                                      <span
                                        className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                                      >
                                        Tempo:{" "}
                                      </span>
                                      {exercise.tempo}
                                    </p>
                                  ) : null}
                                  {exercise.rest ? (
                                    <p>
                                      <span
                                        className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                                      >
                                        Descanso:{" "}
                                      </span>
                                      {exercise.rest}
                                    </p>
                                  ) : null}
                                  {exercise.notes ? (
                                    <p>
                                      <span
                                        className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                                      >
                                        Notas:{" "}
                                      </span>
                                      {exercise.notes}
                                    </p>
                                  ) : null}
                                </div>
                              )}
                            </>
                          )}

                          {/* Show logged data if exists */}
                          {isExerciseLogged(
                            (exercise.exercise_id || "") as string,
                            session.date.toISOString().split("T")[0] as string
                          ) && (
                            <div
                              className={`mt-2 p-2 rounded ${isToday ? "bg-white/10" : "bg-success/10"} border ${isToday ? "border-white/20" : "border-success/20"}`}
                            >
                              {(() => {
                                const log = getExerciseLog(
                                  (exercise.exercise_id || "") as string,
                                  session.date
                                    .toISOString()
                                    .split("T")[0] as string
                                );

                                if (!log) return null;

                                // Check if this is a cardio log
                                const isCardioLog = !!(
                                  log.duration_minutes || log.distance_km
                                );

                                return (
                                  <div className="text-xs space-y-1">
                                    {isCardioLog ? (
                                      // Cardio log display
                                      <p
                                        className={`font-semibold ${isToday ? "text-white" : "text-success"}`}
                                      >
                                        ✓ Registrado:
                                        {log.duration_minutes &&
                                          ` ${log.duration_minutes} min`}
                                        {log.distance_km &&
                                          ` • ${log.distance_km} km`}
                                        {log.intensity && ` • ${log.intensity}`}
                                        {log.avg_heart_rate &&
                                          ` • ${log.avg_heart_rate} bpm`}
                                      </p>
                                    ) : (
                                      // Strength log display
                                      <p
                                        className={`font-semibold ${isToday ? "text-white" : "text-success"}`}
                                      >
                                        ✓ Registrado:{" "}
                                        {log.sets?.length
                                          ? `${log.sets.length} series`
                                          : log.sets_completed
                                            ? `${log.sets_completed}x${log.reps_completed}`
                                            : ""}
                                      </p>
                                    )}
                                    {log.notes && (
                                      <p
                                        className={
                                          isToday
                                            ? "text-white/70"
                                            : "text-foreground/60"
                                        }
                                      >
                                        {log.notes}
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Expanded Details */}
                          {isExerciseExpanded && (
                            <div
                              className={`mt-3 pt-3 ${isToday ? "border-t border-white/10" : "border-t border-default-200"} space-y-2`}
                            >
                              {/* Cardio exercise expanded details */}
                              {exercise.category === "cardio" ? (
                                <>
                                  {exercise.cardioType && (
                                    <div className="flex items-center gap-2">
                                      <Icon
                                        className={
                                          isToday
                                            ? "text-white/60"
                                            : "text-primary"
                                        }
                                        icon="solar:heart-pulse-bold"
                                        width={14}
                                      />
                                      <span
                                        className={`text-xs ${isToday ? "text-white/80" : "text-foreground/60"} font-body`}
                                      >
                                        Tipo:{" "}
                                        <span
                                          className={`font-semibold ${isToday ? "text-white" : "text-foreground"}`}
                                        >
                                          {exercise.cardioType}
                                        </span>
                                      </span>
                                    </div>
                                  )}
                                  {exercise.description && (
                                    <div className="flex items-start gap-2">
                                      <Icon
                                        className={
                                          isToday
                                            ? "text-white/60"
                                            : "text-secondary"
                                        }
                                        icon="solar:document-text-bold"
                                        width={14}
                                      />
                                      <span
                                        className={`text-xs ${isToday ? "text-white/80" : "text-foreground/60"} font-body flex-1`}
                                      >
                                        {exercise.description}
                                      </span>
                                    </div>
                                  )}
                                  {exercise.notes && (
                                    <div className="flex items-start gap-2">
                                      <Icon
                                        className={
                                          isToday
                                            ? "text-white/60"
                                            : "text-secondary"
                                        }
                                        icon="solar:notes-bold"
                                        width={14}
                                      />
                                      <span
                                        className={`text-xs ${isToday ? "text-white/80" : "text-foreground/60"} font-body flex-1`}
                                      >
                                        {exercise.notes}
                                      </span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                // Strength exercise expanded details (existing code)
                                <>
                                  {exercise.trainingSystem && (
                                    <div className="flex items-center gap-2">
                                      <Icon
                                        className={
                                          isToday
                                            ? "text-white/60"
                                            : "text-primary"
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
                                  )}
                                  {exercise.tempo && (
                                    <div className="flex items-center gap-2">
                                      <Icon
                                        className={
                                          isToday
                                            ? "text-white/60"
                                            : "text-secondary"
                                        }
                                        icon="solar:stopwatch-bold"
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
                                  )}
                                  {exercise.rest && (
                                    <div className="flex items-center gap-2">
                                      <Icon
                                        className={
                                          isToday
                                            ? "text-white/60"
                                            : "text-warning"
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
                                  )}
                                  {exercise.description && (
                                    <div className="flex items-start gap-2">
                                      <Icon
                                        className={
                                          isToday
                                            ? "text-white/60"
                                            : "text-secondary"
                                        }
                                        icon="solar:document-text-bold"
                                        width={14}
                                      />
                                      <span
                                        className={`text-xs ${isToday ? "text-white/80" : "text-foreground/60"} font-body flex-1`}
                                      >
                                        {exercise.description}
                                      </span>
                                    </div>
                                  )}
                                  {exercise.notes && (
                                    <div className="flex items-start gap-2">
                                      <Icon
                                        className={
                                          isToday
                                            ? "text-white/60"
                                            : "text-secondary"
                                        }
                                        icon="solar:notes-bold"
                                        width={14}
                                      />
                                      <span
                                        className={`text-xs ${isToday ? "text-white/80" : "text-foreground/60"} font-body flex-1`}
                                      >
                                        {exercise.notes}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
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

                      {/* Action Buttons - Right Side */}
                      <div
                        className="flex items-start gap-2 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Image Button */}
                        {exercise.imageUrl && (
                          <Button
                            isIconOnly
                            className={`h-8 w-8 min-w-8 ${isToday ? "bg-white/20" : ""}`}
                            size="sm"
                            variant="flat"
                            onPress={() =>
                              handleOpenImage(
                                exercise.imageUrl || "",
                                exercise.name
                              )
                            }
                          >
                            <Icon
                              className={
                                isToday ? "text-white" : "text-secondary"
                              }
                              icon="solar:gallery-bold"
                              width={18}
                            />
                          </Button>
                        )}

                        {/* Uploaded Vertical Video Button */}
                        {exercise.uploadedVideoUrl && (
                          <Button
                            isIconOnly
                            className={`h-8 w-8 min-w-8 ${isToday ? "bg-white/20" : ""}`}
                            size="sm"
                            variant="flat"
                            onPress={() =>
                              handleOpenVerticalVideo(
                                exercise.uploadedVideoUrl || "",
                                exercise.name
                              )
                            }
                          >
                            <Icon
                              className={
                                isToday ? "text-white" : "text-primary"
                              }
                              icon="solar:clapperboard-play-bold"
                              width={18}
                            />
                          </Button>
                        )}

                        {/* YouTube/External Video Button */}
                        {exercise.videoUrl && (
                          <Button
                            isIconOnly
                            className={`h-8 w-8 min-w-8 ${isToday ? "bg-white/20" : ""}`}
                            size="sm"
                            variant="flat"
                            onPress={() =>
                              handleOpenVideo(
                                exercise.videoUrl || "",
                                exercise.name
                              )
                            }
                          >
                            <Icon
                              className={
                                isToday ? "text-white" : "text-primary"
                              }
                              icon="solar:play-circle-bold"
                              width={18}
                            />
                          </Button>
                        )}

                        {/* Checkbox Button */}
                        <button
                          className="flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            const exerciseId = (exercise.exercise_id ||
                              "") as string;
                            const dateStr = session.date
                              .toISOString()
                              .split("T")[0] as string;
                            const existingLog = getExerciseLog(
                              exerciseId,
                              dateStr
                            );

                            handleOpenExerciseLog(
                              exercise,
                              session.sessionId,
                              dateStr,
                              existingLog
                            );
                          }}
                        >
                          {isExerciseLogged(
                            (exercise.exercise_id || "") as string,
                            session.date.toISOString().split("T")[0] as string
                          ) ? (
                            <Icon
                              className="text-success"
                              icon="solar:check-circle-bold"
                              width={24}
                            />
                          ) : (
                            <Icon
                              className={
                                isToday
                                  ? "text-white/40 hover:text-white/60"
                                  : "text-foreground/40 hover:text-foreground/60"
                              }
                              icon="solar:check-circle-linear"
                              width={24}
                            />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto">
          {/* Top Header - Same as Dashboard */}
          <ClientHeader
            clientId={clientId}
            clientProfilePicture={clientProfilePicture}
            firstName={firstName}
            logoUrl={logoUrl}
            tenantSlug={tenantSlug}
            trainerName={trainerName}
          />

          <div className="px-4 space-y-6 w-full">
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <Spinner size="lg" />
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <Card className="bg-content1 border border-danger-200">
                <CardBody className="p-12 text-center">
                  <Icon
                    className="text-danger text-6xl mx-auto mb-4"
                    icon="solar:danger-circle-bold"
                  />
                  <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
                    Error al cargar entrenamientos
                  </h3>
                  <p className="text-foreground/60 font-body text-sm mb-4">
                    {error}
                  </p>
                  <Button
                    color="primary"
                    startContent={
                      <Icon icon="solar:refresh-linear" width={18} />
                    }
                    onPress={() => refetchPrograms()}
                  >
                    Reintentar
                  </Button>
                </CardBody>
              </Card>
            )}

            {/* Today's Training - Most Prominent */}
            {!isLoading && !error && todaySession && (
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
            {!isLoading && !error && tomorrowSession && (
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

            {/* Upcoming Sessions */}
            {!isLoading && !error && upcomingSessions.length > 0 && (
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

            {/* Yesterday's Training */}
            {!isLoading && !error && yesterdaySession && (
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

            {/* Past Sessions */}
            {!isLoading && !error && pastSessions.length > 0 && (
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

            {/* Active program but no sessions matched the calendar (data / days) */}
            {!isLoading &&
              !error &&
              activePrograms.length > 0 &&
              scheduledSessions.length === 0 && (
                <Card className="bg-content1 border border-amber-200 shadow-sm">
                  <CardBody className="p-8">
                    <div className="flex flex-col items-center justify-center text-center gap-2">
                      <Icon
                        className="text-amber-600 text-5xl mb-1"
                        icon="solar:calendar-minimalistic-bold"
                      />
                      <h3 className="text-lg font-semibold text-foreground font-heading">
                        No pudimos mostrar tus sesiones
                      </h3>
                      <p className="text-foreground/70 text-sm font-body max-w-sm">
                        Tienes un programa activo, pero no hay entrenamientos
                        enlazados a los días del calendario. Suele deberse a
                        cómo están guardados los días de la semana en la sesión.
                        Contacta a tu entrenador para que lo revise.
                      </p>
                      <Button
                        className="mt-2"
                        color="primary"
                        size="sm"
                        variant="flat"
                        onPress={() => refetchPrograms()}
                      >
                        Actualizar
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              )}

            {/* No Active Program State */}
            {!isLoading && !error && activePrograms.length === 0 && (
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

      {/* Modals */}
      <ExerciseLogModal
        clientId={clientId}
        exercise={selectedExercise}
        exerciseId={selectedExercise?.exercise_id || ""}
        existingLog={selectedExercise?.existingLog || null}
        isOpen={isExerciseLogModalOpen}
        scheduledDate={selectedExercise?.scheduledDate || ""}
        sessionId={selectedExercise?.sessionId || ""}
        onClose={() => setIsExerciseLogModalOpen(false)}
        onSuccess={() => {
          // Invalidate exercise logs — TanStack Query refetches in the
          // background while keeping current data visible (no spinner).
          queryClient.invalidateQueries({
            queryKey: ["client", "exerciseLogs", clientId],
          });
        }}
      />

      <RescheduleModal
        clientId={clientId}
        currentDate={selectedRescheduleSession?.currentDate || ""}
        isOpen={isRescheduleModalOpen}
        scheduledSessionId={selectedRescheduleSession?.scheduledSessionId ?? ""}
        sessionId={selectedRescheduleSession?.sessionId ?? ""}
        sessionName={selectedRescheduleSession?.sessionName || ""}
        onClose={() => setIsRescheduleModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ["client", "scheduledSessions", clientId],
          });
          queryClient.invalidateQueries({
            queryKey: ["client", "programs"],
          });
        }}
      />

      <VideoPlayerModal
        exerciseName={selectedVideoExerciseName}
        isOpen={isVideoModalOpen}
        videoUrl={selectedVideoUrl}
        onClose={() => setIsVideoModalOpen(false)}
      />

      <VerticalVideoPlayerModal ref={verticalPlayerRef} />

      {/* Image Preview Modal */}
      <Modal
        classNames={{
          base: "max-h-[90vh]",
          header: "border-b border-default-200",
          body: "p-0",
        }}
        isOpen={isImageModalOpen}
        placement="center"
        size="3xl"
        onClose={() => setIsImageModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="bg-secondary p-2 rounded-lg">
                <Icon
                  className="text-white text-xl"
                  icon="solar:gallery-bold"
                />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-heading font-bold text-foreground">
                  {selectedImageExerciseName}
                </h3>
                <p className="text-sm text-foreground/60 font-body font-normal">
                  Referencia del Ejercicio
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="w-full p-4">
              <img
                alt={selectedImageExerciseName}
                className="w-full h-auto rounded-lg object-contain max-h-[70vh]"
                src={selectedImageUrl}
              />
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
