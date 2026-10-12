"use client";

import { Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useClientData } from "./client-data-provider";

import { ClientScreen } from "@/components/client-dashboard/client-screen";
import { TenantLogo } from "@/components/tenant-logo";
import { clientFetch } from "@/lib/auth/client-token-storage";
import {
  useRealtimeMessages,
  RealtimeMessage,
} from "@/lib/hooks/use-realtime-messages";

interface Message {
  id: string;
  sender_type: "client" | "trainer";
  sender_name: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

/** Mensaje propio que aún no confirmó el servidor (o que falló). */
interface Outgoing {
  localId: string;
  text: string;
  created_at: string;
  status: "pending" | "failed";
}

interface Row {
  id: string;
  mine: boolean;
  text: string;
  created_at: string;
  status?: Outgoing["status"];
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  trainerName: string;
  clientId: string;
  tenantSlug: string;
}

const GROUP_GAP_MS = 5 * 60_000;
const COMPOSER_MAX_PX = 132;

export function ChatPanel({
  isOpen,
  onClose,
  trainerName,
  clientId,
  tenantSlug,
}: ChatPanelProps) {
  const { logoUrl } = useClientData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [newMessage, setNewMessage] = useState("");
  // Solo la PRIMERA carga pinta el spinner; los refrescos en segundo plano
  // (poll de 30s, realtime) no deben vaciar la conversación.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showNewPill, setShowNewPill] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);
  const stickNextRef = useRef(true);
  const rowCountRef = useRef(0);

  const handleRealtimeMessage = useCallback((msg: RealtimeMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;

      return [...prev, msg as unknown as Message];
    });
  }, []);

  const { refreshTrigger } = useRealtimeMessages({
    clientId: isOpen ? clientId : null,
    userId: clientId,
    userType: "client",
    onNewMessage: handleRealtimeMessage,
  });

  const scrollToBottom = (smooth: boolean) => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    endRef.current?.scrollIntoView({
      behavior: smooth && !reduce ? "smooth" : "auto",
      block: "end",
    });
  };

  // Load messages
  const loadMessages = async () => {
    try {
      const response = await clientFetch(
        `/api/messages?clientId=${clientId}&tenantSlug=${tenantSlug}`
      );

      if (response.ok) {
        const data = await response.json();

        setMessages(data.messages || []);

        // Mark messages as read
        const unreadIds = data.messages
          .filter((m: Message) => !m.read_at && m.sender_type === "trainer")
          .map((m: Message) => m.id);

        if (unreadIds.length > 0) {
          await clientFetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageIds: unreadIds }),
          });
        }
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setHasLoaded(true);
    }
  };

  // Envía (o reintenta) un mensaje propio: se pinta al instante como
  // "pendiente" (reloj) y pasa a "No se envió · Reintentar" si falla.
  const deliver = async (item: Outgoing) => {
    setOutgoing((prev) => [
      ...prev.filter((o) => o.localId !== item.localId),
      { ...item, status: "pending" },
    ]);
    stickNextRef.current = true;

    try {
      const response = await clientFetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          tenantSlug,
          message: item.text,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const sent: Message | undefined = data.message;

      setOutgoing((prev) => prev.filter((o) => o.localId !== item.localId));
      if (sent) {
        setMessages((prev) =>
          prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setOutgoing((prev) =>
        prev.map((o) =>
          o.localId === item.localId ? { ...o, status: "failed" } : o
        )
      );
    }
  };

  const handleSendMessage = () => {
    const text = newMessage.trim();

    if (!text) return;
    setNewMessage("");
    inputRef.current?.focus({ preventScroll: true });
    void deliver({
      localId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      created_at: new Date().toISOString(),
      status: "pending",
    });
  };

  // Load messages when panel opens
  useEffect(() => {
    if (isOpen) {
      stickNextRef.current = true;
      loadMessages();
      // Focus input
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 300);

      // Fallback poll every 30s (Realtime handles instant updates)
      const interval = setInterval(loadMessages, 30_000);

      return () => clearInterval(interval);
    }

    // Al reabrir, vuelve a entrar abajo del todo.
    stickNextRef.current = true;
    setShowNewPill(false);

    return undefined;
  }, [isOpen, clientId, tenantSlug]);

  // Recarga al reconectar el realtime o al volver la pestaña a primer
  // plano (refreshTrigger del hook) — cubre mensajes perdidos mientras el
  // socket estuvo muerto (teléfono bloqueado, PWA en background).
  useEffect(() => {
    if (isOpen && refreshTrigger > 0) {
      loadMessages();
    }
  }, [refreshTrigger]);

  const rows: Row[] = [
    ...messages.map((m) => ({
      id: m.id,
      mine: m.sender_type === "client",
      text: m.message,
      created_at: m.created_at,
    })),
    ...outgoing.map((o) => ({
      id: o.localId,
      mine: true,
      text: o.text,
      created_at: o.created_at,
      status: o.status,
    })),
  ];

  // Al crecer la conversación: baja si el usuario ya estaba abajo (o acaba
  // de enviar / abrir); si estaba leyendo arriba, muestra la píldora.
  useLayoutEffect(() => {
    const grew = rows.length > rowCountRef.current;

    rowCountRef.current = rows.length;
    if (!isOpen) return;
    if (stickNextRef.current || atBottomRef.current) {
      const first = stickNextRef.current;

      stickNextRef.current = false;
      scrollToBottom(!first);
    } else if (grew) {
      setShowNewPill(true);
    }
  }, [rows.length, isOpen]);

  // "¿Está abajo?" sin depender del contenedor de scroll de ClientScreen:
  // observamos el centinela del final.
  useEffect(() => {
    const el = endRef.current;

    if (!isOpen || !el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry?.isIntersecting ?? false;

        atBottomRef.current = visible;
        if (visible) setShowNewPill(false);
      },
      { rootMargin: "0px 0px 80px 0px" }
    );

    io.observe(el);

    return () => io.disconnect();
  }, [isOpen]);

  // Caja de texto que crece con el contenido (hasta ~5 líneas).
  useLayoutEffect(() => {
    const ta = inputRef.current;

    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight + 2, COMPOSER_MAX_PX)}px`;
  }, [newMessage, isOpen]);

  const canSend = newMessage.trim().length > 0;

  return (
    <ClientScreen
      ariaLabel={`Chat con ${trainerName}`}
      bar={false}
      footer={
        <form
          className="-mt-1 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <textarea
            ref={inputRef}
            aria-label={`Mensaje para ${trainerName}`}
            autoCapitalize="sentences"
            autoComplete="off"
            className="h-11 max-h-[132px] min-h-11 min-w-0 flex-1 resize-none rounded-[22px] border border-default-200 bg-content1 px-4 py-[11px] text-base leading-[1.3] text-foreground caret-primary outline-none transition-colors placeholder:text-default-400 focus:border-primary"
            // enterKeyHint falta en los tipos de React instalados (sí existe en runtime).
            {...{ enterKeyHint: "send" }}
            placeholder="Escribe un mensaje..."
            rows={1}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button
            aria-label="Enviar mensaje"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[background-color,color,transform] duration-150 active:scale-[0.97] disabled:bg-default-200 disabled:text-default-500 motion-reduce:active:scale-100"
            disabled={!canSend}
            type="submit"
          >
            <Icon icon="solar:arrow-up-linear" width={22} />
          </button>
        </form>
      }
      isOpen={isOpen}
      onClose={onClose}
    >
      {/* Cabecera propia: volver + avatar con el logo + nombre. */}
      <div className="sticky top-0 z-10 bg-background/80 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_hsl(var(--heroui-default-200))] backdrop-blur-xl backdrop-saturate-150">
        <div className="flex h-[60px] items-center gap-1.5 pl-1 pr-3">
          <button
            className="flex h-11 shrink-0 items-center gap-0.5 rounded-medium pl-1 pr-2 text-base font-medium text-primary active:opacity-60"
            type="button"
            onClick={onClose}
          >
            <Icon className="text-2xl" icon="solar:alt-arrow-left-linear" />
            Volver
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-content1 shadow-small ring-1 ring-default-200"
            >
              {logoUrl ? (
                <TenantLogo
                  alt=""
                  className="h-6 w-auto object-contain"
                  height={24}
                  src={logoUrl}
                  width={34}
                />
              ) : (
                <Icon className="text-xl text-primary" icon="solar:user-bold" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-foreground">
                {trainerName}
              </span>
              <span className="block text-xs text-default-500">
                Tu entrenador
              </span>
            </span>
          </div>
        </div>
      </div>

      <div
        aria-label="Conversación"
        aria-live="polite"
        className="flex min-h-[calc(100dvh-160px)] flex-col overflow-x-clip gap-0.5 px-4 pb-3.5 pt-2"
        role="log"
      >
        {!hasLoaded && rows.length === 0 ? (
          <div className="m-auto">
            <Spinner color="default" />
          </div>
        ) : rows.length === 0 ? (
          <div className="m-auto flex max-w-[300px] flex-col items-center gap-2 px-6 pb-12 pt-6 text-center">
            <span className="mb-1.5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon icon="solar:chat-round-dots-linear" width={28} />
            </span>
            <p className="text-[17px] font-semibold text-foreground">
              Escríbele a {trainerName}
            </p>
            <p className="text-sm leading-relaxed text-default-500">
              Dudas, molestias o cómo te fue el entreno: aquí lo lee tu
              entrenador.
            </p>
          </div>
        ) : (
          rows.map((row, i) => (
            <Bubble
              key={row.id}
              next={rows[i + 1]}
              prev={rows[i - 1]}
              row={row}
              onRetry={(r) =>
                void deliver({
                  localId: r.id,
                  text: r.text,
                  created_at: r.created_at,
                  status: "pending",
                })
              }
            />
          ))
        )}
        <div ref={endRef} className="h-px shrink-0" />
      </div>

      {showNewPill ? (
        <button
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+84px)] left-1/2 z-20 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-default-200 bg-content1 pl-2.5 pr-3.5 text-[13px] font-semibold text-foreground shadow-medium active:scale-[0.97] motion-reduce:active:scale-100"
          type="button"
          onClick={() => {
            scrollToBottom(true);
            setShowNewPill(false);
          }}
        >
          <Icon
            className="text-primary"
            icon="solar:arrow-down-linear"
            width={16}
          />
          Nuevos mensajes
        </button>
      ) : null}
    </ClientScreen>
  );
}

/** Mismo remitente, mismo día y a menos de 5 min → misma racha. */
function joins(a: Row | undefined, b: Row | undefined): boolean {
  if (!a || !b || a.mine !== b.mine) return false;
  if (dayKey(a.created_at) !== dayKey(b.created_at)) return false;

  return (
    Math.abs(
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ) < GROUP_GAP_MS
  );
}

function Bubble({
  row,
  prev,
  next,
  onRetry,
}: {
  row: Row;
  prev: Row | undefined;
  next: Row | undefined;
  onRetry: (row: Row) => void;
}) {
  const first = !joins(prev, row);
  const last = !joins(row, next);
  const newDay = !prev || dayKey(prev.created_at) !== dayKey(row.created_at);
  // Esquinas: 20px, y 6px en el lado del remitente donde la burbuja se
  // pega a otra de la misma racha. La "cola" solo en la última.
  const corners = row.mine
    ? `${first ? "" : "rounded-tr-md"} ${last ? "" : "rounded-br-md"}`
    : `${first ? "" : "rounded-tl-md"} ${last ? "" : "rounded-bl-md"}`;
  const tail = last
    ? row.mine
      ? "before:absolute before:bottom-0 before:right-[-7px] before:h-5 before:w-5 before:rounded-bl-[16px_14px] before:bg-primary after:absolute after:bottom-0 after:right-[-26px] after:h-5 after:w-[26px] after:rounded-bl-[10px] after:bg-background"
      : "before:absolute before:bottom-0 before:left-[-7px] before:h-5 before:w-5 before:rounded-br-[16px_14px] before:bg-content1 after:absolute after:bottom-0 after:left-[-26px] after:h-5 after:w-[26px] after:rounded-br-[10px] after:bg-background"
    : "";

  return (
    <>
      {newDay ? (
        <div className="mb-2 mt-3.5 flex justify-center first:mt-0">
          <span className="rounded-full bg-default-100 px-2.5 py-1 text-xs font-semibold text-default-500">
            {dayLabel(row.created_at)}
          </span>
        </div>
      ) : null}
      <div
        className={`relative max-w-[80%] whitespace-pre-wrap break-words rounded-[20px] px-3 py-[7px] text-[15px] leading-[1.36] [overflow-wrap:anywhere] ${
          first ? "mt-1.5" : ""
        } ${
          row.mine
            ? "self-end bg-primary text-primary-foreground"
            : "self-start bg-content1 text-foreground"
        } ${corners} ${tail}`}
      >
        {row.text}
        <span
          className={`float-right -mb-1 ml-2.5 mt-[7px] inline-flex items-center text-[11px] leading-none tabular-nums ${
            row.status === "failed" ? "" : "opacity-70"
          }`}
        >
          {row.status === "pending" ? (
            <Icon
              aria-label="Enviando"
              icon="solar:clock-circle-linear"
              width={13}
            />
          ) : row.status === "failed" ? (
            <Icon
              aria-label="No enviado"
              icon="solar:danger-circle-linear"
              width={13}
            />
          ) : (
            timeLabel(row.created_at)
          )}
        </span>
      </div>
      {row.status === "failed" ? (
        <button
          className="flex min-h-9 items-center gap-1.5 self-end px-0.5 text-[13px] font-semibold text-danger active:opacity-60"
          type="button"
          onClick={() => onRetry(row)}
        >
          <Icon icon="solar:danger-circle-linear" width={15} />
          No se envió · Reintentar
        </button>
      ) : null}
    </>
  );
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

/** "Hoy", "Ayer" o "31 mar" (con año si no es el actual). */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";

  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
