"use client";

import { Button, Input, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";

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

  useRealtimeMessages({
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

      // Fallback poll every 60s (Realtime handles instant updates)
      const interval = setInterval(loadMessages, 60_000);

      return () => clearInterval(interval);
    }

    return undefined;
  }, [isOpen, clientId, tenantSlug]);

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

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMins < 1) return "Ahora";
    if (diffInMins < 60) return `Hace ${diffInMins}m`;
    if (diffInHours < 24) return `Hace ${diffInHours}h`;
    if (diffInDays < 7) return `Hace ${diffInDays}d`;

    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        aria-label="Close chat"
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      />

      {/* Chat Panel */}
      <div
        className={`fixed top-0 right-0 h-[calc(100vh-4rem)] w-full md:w-96 bg-background z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0 md:shadow-2xl" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-divider bg-content1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="text-primary text-xl" icon="solar:user-bold" />
            </div>
            <div>
              <h3 className="font-semibold font-heading text-foreground">
                {trainerName}
              </h3>
              <p className="text-xs text-foreground/60 font-body">
                Tu entrenador
              </p>
            </div>
          </div>
          <Button isIconOnly size="sm" variant="light" onPress={onClose}>
            <Icon className="text-2xl" icon="solar:close-circle-linear" />
          </Button>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner color="primary" size="lg" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Icon
                className="text-6xl text-foreground/20 mb-4"
                icon="solar:chat-round-dots-linear"
              />
              <p className="text-foreground/60 font-body">
                No hay mensajes aún. <br />
                ¡Inicia la conversación!
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_type === "client" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.sender_type === "client"
                      ? "bg-primary text-primary-foreground"
                      : "bg-content2 text-foreground"
                  }`}
                >
                  <p className="text-sm font-body whitespace-pre-wrap break-words">
                    {msg.message}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.sender_type === "client"
                        ? "text-primary-foreground/70"
                        : "text-foreground/50"
                    }`}
                  >
                    {formatTimeAgo(msg.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-4 py-3 border-t-2 border-divider bg-content1 shadow-lg">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              className="flex-1"
              classNames={{
                input: "font-body text-base",
                inputWrapper: "h-12 bg-content2",
              }}
              disabled={isSending}
              placeholder="Escribe un mensaje..."
              size="lg"
              value={newMessage}
              variant="bordered"
              onKeyPress={handleKeyPress}
              onValueChange={setNewMessage}
            />
            <Button
              isIconOnly
              color="primary"
              isDisabled={!newMessage.trim() || isSending}
              isLoading={isSending}
              size="lg"
              onPress={handleSendMessage}
            >
              <Icon className="text-xl" icon="solar:plain-2-bold" />
            </Button>
          </div>
          <p className="text-xs text-foreground/50 mt-2 text-center">
            Presiona Enter para enviar
          </p>
        </div>
      </div>
    </>
  );
}
