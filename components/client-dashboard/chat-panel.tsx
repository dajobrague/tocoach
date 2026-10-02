"use client";

import { Button, Input, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useClientData } from "./client-data-provider";

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

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  trainerName: string;
  clientId: string;
  tenantSlug: string;
}

export function ChatPanel({
  isOpen,
  onClose,
  trainerName,
  clientId,
  tenantSlug,
}: ChatPanelProps) {
  const { logoUrl } = useClientData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load messages
  const loadMessages = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const response = await clientFetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          tenantSlug,
          message: newMessage.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();

        setMessages((prev) => [...prev, data.message]);
        setNewMessage("");
        scrollToBottom();
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Load messages when panel opens
  useEffect(() => {
    if (isOpen) {
      loadMessages();
      // Focus input
      setTimeout(() => inputRef.current?.focus(), 300);

      // Fallback poll every 30s (Realtime handles instant updates)
      const interval = setInterval(loadMessages, 30_000);

      return () => clearInterval(interval);
    }

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

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Backdrop (solo se ve en escritorio, donde el panel es lateral) */}
      <div
        aria-label="Cerrar chat"
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      />

      {/* Panel: pantalla completa en móvil (por encima de la barra de
          navegación, que antes tapaba la caja de escribir), lateral en
          escritorio. */}
      <div
        aria-label={`Chat con ${trainerName}`}
        aria-modal="true"
        className={`fixed inset-y-0 right-0 z-[60] flex h-[100dvh] w-full transform flex-col bg-background transition-transform duration-300 ease-in-out md:w-96 ${
          isOpen ? "translate-x-0 md:shadow-2xl" : "translate-x-full"
        }`}
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-default-200 bg-background px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <Button
            isIconOnly
            aria-label="Volver"
            variant="light"
            onPress={onClose}
          >
            <Icon icon="solar:alt-arrow-left-linear" width={24} />
          </Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-content1 shadow-small">
            {logoUrl ? (
              <TenantLogo
                alt={trainerName}
                className="h-7 w-auto object-contain"
                height={28}
                src={logoUrl}
                width={40}
              />
            ) : (
              <Icon className="text-xl text-primary" icon="solar:user-bold" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-heading text-base text-foreground">
              {trainerName}
            </h3>
            <p className="text-xs text-default-500">Tu entrenador</p>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner color="primary" size="lg" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Icon
                  className="text-3xl text-primary"
                  icon="solar:chat-round-dots-linear"
                />
              </div>
              <p className="font-heading text-base text-foreground">
                Escríbele a {trainerName}
              </p>
              <p className="mt-1 text-sm text-default-500">
                Dudas, molestias o cómo te fue el entreno: aquí lo lee tu
                entrenador.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const mine = msg.sender_type === "client";
              const newDay =
                !prev || dayKey(prev.created_at) !== dayKey(msg.created_at);
              // Burbujas seguidas del mismo remitente (mismo día) se agrupan:
              // menos aire entre ellas y solo la última lleva la "cola".
              const groupedWithPrev =
                !newDay && prev?.sender_type === msg.sender_type;
              const lastOfGroup =
                !next ||
                next.sender_type !== msg.sender_type ||
                dayKey(next.created_at) !== dayKey(msg.created_at);

              return (
                <div key={msg.id}>
                  {newDay ? (
                    <div className="my-4 flex justify-center first:mt-0">
                      <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-600">
                        {dayLabel(msg.created_at)}
                      </span>
                    </div>
                  ) : null}
                  <div
                    className={`flex ${mine ? "justify-end" : "justify-start"} ${
                      groupedWithPrev ? "mt-1" : "mt-3"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] px-3.5 py-2 ${
                        mine
                          ? `bg-primary text-primary-foreground ${
                              lastOfGroup
                                ? "rounded-2xl rounded-br-md"
                                : "rounded-2xl"
                            }`
                          : `bg-content1 text-foreground shadow-small ${
                              lastOfGroup
                                ? "rounded-2xl rounded-bl-md"
                                : "rounded-2xl"
                            }`
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
                        {msg.message}
                      </p>
                      <p
                        className={`mt-0.5 text-right text-[11px] ${
                          mine
                            ? "text-primary-foreground/70"
                            : "text-default-400"
                        }`}
                      >
                        {timeLabel(msg.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-default-200 bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              className="flex-1"
              classNames={{
                input: "text-base",
                inputWrapper:
                  "h-12 rounded-full bg-default-100 px-4 shadow-none",
              }}
              disabled={isSending}
              placeholder="Escribe un mensaje..."
              size="lg"
              value={newMessage}
              onKeyPress={handleKeyPress}
              onValueChange={setNewMessage}
            />
            <Button
              isIconOnly
              aria-label="Enviar mensaje"
              className="h-12 w-12 min-w-12 rounded-full"
              color="primary"
              isDisabled={!newMessage.trim() || isSending}
              isLoading={isSending}
              onPress={handleSendMessage}
            >
              <Icon className="text-xl" icon="solar:plain-2-bold" />
            </Button>
          </div>
        </div>
      </div>
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
