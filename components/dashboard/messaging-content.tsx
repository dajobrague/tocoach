"use client";

import {
  Avatar,
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  ScrollShadow,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  sender_type: "client" | "trainer";
  sender_name: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

interface Conversation {
  id: number;
  full_name: string;
  email: string;
  avatar_url: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageSender: "client" | "trainer" | null;
  unreadCount: number;
}

export default function MessagingContent() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load conversations
  const loadConversations = async () => {
    setIsLoadingConversations(true);
    try {
      const response = await fetch(
        "/api/messages/trainer?conversationsOnly=true"
      );

      if (response.ok) {
        const data = await response.json();

        setConversations(data.conversations || []);

        // Auto-select first conversation if none selected
        if (!selectedConversation && data.conversations.length > 0) {
          setSelectedConversation(data.conversations[0]);
        }
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // Load messages for selected conversation
  const loadMessages = async (clientId: number) => {
    setIsLoadingMessages(true);
    try {
      const response = await fetch(
        `/api/messages/trainer?clientId=${clientId}`
      );

      if (response.ok) {
        const data = await response.json();

        setMessages(data.messages || []);

        // Update conversation unread count to 0
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === clientId ? { ...conv, unreadCount: 0 } : conv
          )
        );
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending || !selectedConversation) return;

    setIsSending(true);
    try {
      const response = await fetch("/api/messages/trainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedConversation.id,
          message: newMessage.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();

        setMessages((prev) => [...prev, data.message]);
        setNewMessage("");

        // Update last message in conversations
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversation.id
              ? {
                  ...conv,
                  lastMessage: data.message.message,
                  lastMessageAt: data.message.created_at,
                  lastMessageSender: "trainer",
                }
              : conv
          )
        );

        scrollToBottom();
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Filter conversations
  const filteredConversations = conversations.filter((conv) =>
    conv.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Format timestamp
  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMins < 1) return "Ahora";
    if (diffInMins < 60) return `Hace ${diffInMins} min`;
    if (diffInHours < 24) return `Hace ${diffInHours}h`;
    if (diffInDays === 1) return "Ayer";
    if (diffInDays < 7) return `Hace ${diffInDays} días`;

    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  // Format message time
  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-[calc(100vh-80px)] bg-gray-50">
      {/* Conversations List - Left Sidebar */}
      <div className="w-full md:w-80 lg:w-96 border-r border-gray-200 bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Mensajes</h1>
            <Button
              isIconOnly
              className="text-gray-600"
              size="sm"
              variant="light"
              onPress={loadConversations}
            >
              <Icon icon="solar:refresh-linear" width={20} />
            </Button>
          </div>
          <Input
            classNames={{
              input: "text-sm",
              inputWrapper: "border-gray-200",
            }}
            placeholder="Buscar conversaciones..."
            size="sm"
            startContent={
              <Icon
                className="text-gray-400"
                icon="solar:magnifer-linear"
                width={18}
              />
            }
            value={searchQuery}
            variant="bordered"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Conversations */}
        <ScrollShadow className="flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center h-full">
              <Spinner color="primary" size="lg" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Icon
                className="text-6xl text-gray-300 mb-4"
                icon="solar:chat-round-dots-linear"
              />
              <p className="text-gray-500">
                {searchQuery
                  ? "No se encontraron conversaciones"
                  : "No hay conversaciones aún"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  className={`
                                        w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors
                                        ${selectedConversation?.id === conversation.id ? "bg-blue-50" : ""}
                                    `}
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar
                      name={getInitials(conversation.full_name)}
                      {...(conversation.avatar_url
                        ? { src: conversation.avatar_url }
                        : {})}
                      color="primary"
                      isBordered={selectedConversation?.id === conversation.id}
                      size="md"
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">
                        {conversation.full_name}
                      </h3>
                      {conversation.unreadCount > 0 && (
                        <Chip
                          className="h-5 min-w-5 px-1"
                          color="primary"
                          size="sm"
                          variant="solid"
                        >
                          {conversation.unreadCount}
                        </Chip>
                      )}
                    </div>
                    {conversation.lastMessage && (
                      <>
                        <p className="text-xs text-gray-600 truncate mb-1">
                          {conversation.lastMessageSender === "trainer" &&
                            "Tú: "}
                          {conversation.lastMessage}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatTimeAgo(conversation.lastMessageAt)}
                        </p>
                      </>
                    )}
                    {!conversation.lastMessage && (
                      <p className="text-xs text-gray-400">Sin mensajes</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollShadow>
      </div>

      {/* Chat Area - Right Side */}
      <div className="flex-1 flex flex-col bg-white">
        {!selectedConversation ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Icon
              className="text-8xl text-gray-300 mb-4"
              icon="solar:chat-round-line-linear"
            />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Selecciona una conversación
            </h3>
            <p className="text-gray-500">
              Elige un cliente de la lista para comenzar a chatear
            </p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  name={getInitials(selectedConversation.full_name)}
                  {...(selectedConversation.avatar_url
                    ? { src: selectedConversation.avatar_url }
                    : {})}
                  isBordered
                  color="primary"
                  size="md"
                />
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {selectedConversation.full_name}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {selectedConversation.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  isIconOnly
                  className="text-gray-600"
                  size="sm"
                  variant="light"
                  onPress={() => loadMessages(selectedConversation.id)}
                >
                  <Icon icon="solar:refresh-linear" width={20} />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollShadow className="flex-1 p-4 overflow-y-auto bg-gray-50">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner color="primary" size="lg" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <Icon
                    className="text-6xl text-gray-300 mb-4"
                    icon="solar:chat-round-dots-linear"
                  />
                  <p className="text-gray-500">
                    No hay mensajes aún. <br />
                    ¡Inicia la conversación!
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-w-4xl mx-auto">
                  {messages.map((message) => {
                    const isOwn = message.sender_type === "trainer";

                    return (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {!isOwn && (
                          <Avatar
                            name={getInitials(selectedConversation.full_name)}
                            {...(selectedConversation.avatar_url
                              ? { src: selectedConversation.avatar_url }
                              : {})}
                            className="flex-shrink-0"
                            color="primary"
                            size="sm"
                          />
                        )}
                        <div
                          className={`flex flex-col gap-1 max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}
                        >
                          <Card
                            className={`
                                                            ${
                                                              isOwn
                                                                ? "bg-blue-600 text-white"
                                                                : "bg-white text-gray-900"
                                                            }
                                                            shadow-sm
                                                        `}
                          >
                            <CardBody className="p-3">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {message.message}
                              </p>
                            </CardBody>
                          </Card>
                          <p
                            className={`text-xs text-gray-400 px-1 ${isOwn ? "text-right" : "text-left"}`}
                          >
                            {formatMessageTime(message.created_at)}
                          </p>
                        </div>
                        {isOwn && (
                          <Avatar
                            className="flex-shrink-0"
                            color="success"
                            name="T"
                            size="sm"
                          />
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollShadow>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-end gap-2">
                  <Input
                    classNames={{
                      input: "text-sm",
                      inputWrapper: "border-gray-200 bg-gray-50",
                    }}
                    isDisabled={isSending}
                    placeholder="Escribe un mensaje..."
                    size="lg"
                    value={newMessage}
                    variant="bordered"
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    isIconOnly
                    className="flex-shrink-0"
                    color="primary"
                    isDisabled={newMessage.trim() === "" || isSending}
                    isLoading={isSending}
                    size="lg"
                    onPress={handleSendMessage}
                  >
                    <Icon icon="solar:plain-2-bold" width={20} />
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Presiona Enter para enviar, Shift + Enter para nueva línea
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
