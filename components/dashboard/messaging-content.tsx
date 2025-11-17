"use client";

import {
    Avatar,
    Badge,
    Button,
    Card,
    CardBody,
    Chip,
    Input,
    ScrollShadow
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

// Mock data
const mockConversations = [
    {
        id: "1",
        clientName: "María García",
        clientAvatar: "MG",
        lastMessage: "Gracias por el plan de entrenamiento, lo voy a seguir al pie de la letra",
        timestamp: "Hace 5 min",
        unread: 2,
        online: true,
    },
    {
        id: "2",
        clientName: "Carlos López",
        clientAvatar: "CL",
        lastMessage: "¿A qué hora es nuestra sesión de mañana?",
        timestamp: "Hace 15 min",
        unread: 0,
        online: true,
    },
    {
        id: "3",
        clientName: "Ana Martínez",
        clientAvatar: "AM",
        lastMessage: "Completé todos los ejercicios de hoy 💪",
        timestamp: "Hace 1 hora",
        unread: 1,
        online: false,
    },
    {
        id: "4",
        clientName: "Juan Pérez",
        clientAvatar: "JP",
        lastMessage: "Necesito ajustar mi dieta, ¿podemos hablar?",
        timestamp: "Hace 2 horas",
        unread: 0,
        online: false,
    },
    {
        id: "5",
        clientName: "Laura Fernández",
        clientAvatar: "LF",
        lastMessage: "Excelente sesión hoy, gracias!",
        timestamp: "Ayer",
        unread: 0,
        online: false,
    },
    {
        id: "6",
        clientName: "Roberto Silva",
        clientAvatar: "RS",
        lastMessage: "¿Puedo cambiar mi horario de la semana que viene?",
        timestamp: "Ayer",
        unread: 0,
        online: true,
    },
];

const mockMessages = [
    {
        id: "1",
        senderId: "client",
        senderName: "María García",
        content: "Hola! Tengo una duda sobre el plan de entrenamiento",
        timestamp: "10:30 AM",
        isOwn: false,
    },
    {
        id: "2",
        senderId: "trainer",
        senderName: "Entrenador",
        content: "¡Hola María! Claro, dime en qué puedo ayudarte",
        timestamp: "10:31 AM",
        isOwn: true,
    },
    {
        id: "3",
        senderId: "client",
        senderName: "María García",
        content: "En el día 3, ¿puedo sustituir las sentadillas por otro ejercicio? Tengo una molestia en la rodilla",
        timestamp: "10:32 AM",
        isOwn: false,
    },
    {
        id: "4",
        senderId: "trainer",
        senderName: "Entrenador",
        content: "Por supuesto, cuida tu salud primero. Te recomiendo reemplazarlas por ejercicios de bajo impacto como extensiones de cuádriceps en máquina o prensa de piernas con menos peso.",
        timestamp: "10:33 AM",
        isOwn: true,
    },
    {
        id: "5",
        senderId: "trainer",
        senderName: "Entrenador",
        content: "¿Has consultado con un fisioterapeuta sobre esa molestia?",
        timestamp: "10:33 AM",
        isOwn: true,
    },
    {
        id: "6",
        senderId: "client",
        senderName: "María García",
        content: "Sí, me dijo que es algo leve y que con reposo mejorará. Me recomendó ejercicios de bajo impacto por ahora",
        timestamp: "10:35 AM",
        isOwn: false,
    },
    {
        id: "7",
        senderId: "trainer",
        senderName: "Entrenador",
        content: "Perfecto entonces. Voy a ajustar tu plan para esta semana con ejercicios alternativos. Te lo envío en unos minutos",
        timestamp: "10:36 AM",
        isOwn: true,
    },
    {
        id: "8",
        senderId: "client",
        senderName: "María García",
        content: "Gracias por el plan de entrenamiento, lo voy a seguir al pie de la letra",
        timestamp: "10:38 AM",
        isOwn: false,
    },
];

export default function MessagingContent() {
    const [selectedConversation, setSelectedConversation] = useState(mockConversations[0]);
    const [messages, setMessages] = useState(mockMessages);
    const [newMessage, setNewMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const handleSendMessage = () => {
        if (newMessage.trim() === "") return;

        const message = {
            id: String(messages.length + 1),
            senderId: "trainer",
            senderName: "Entrenador",
            content: newMessage,
            timestamp: new Date().toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
            }),
            isOwn: true,
        };

        setMessages([...messages, message]);
        setNewMessage("");
    };

    const filteredConversations = mockConversations.filter((conv) =>
        conv.clientName.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                            variant="light"
                            className="text-gray-600"
                            size="sm"
                        >
                            <Icon icon="solar:settings-linear" width={20} />
                        </Button>
                    </div>
                    <Input
                        placeholder="Buscar conversaciones..."
                        startContent={
                            <Icon icon="solar:magnifer-linear" className="text-gray-400" width={18} />
                        }
                        variant="bordered"
                        size="sm"
                        classNames={{
                            input: "text-sm",
                            inputWrapper: "border-gray-200",
                        }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Conversations */}
                <ScrollShadow className="flex-1 overflow-y-auto">
                    <div className="divide-y divide-gray-100">
                        {filteredConversations.map((conversation) => (
                            <button
                                key={conversation.id}
                                onClick={() => setSelectedConversation(conversation)}
                                className={`
                                    w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors
                                    ${selectedConversation?.id === conversation.id ? "bg-blue-50" : ""}
                                `}
                            >
                                <div className="relative flex-shrink-0">
                                    <Badge
                                        content=""
                                        color={conversation.online ? "success" : "default"}
                                        shape="circle"
                                        placement="bottom-right"
                                        size="sm"
                                        showOutline={false}
                                        isInvisible={!conversation.online}
                                    >
                                        <Avatar
                                            name={conversation.clientAvatar}
                                            size="md"
                                            color="primary"
                                            isBordered={selectedConversation?.id === conversation.id}
                                        />
                                    </Badge>
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className="font-semibold text-sm text-gray-900 truncate">
                                            {conversation.clientName}
                                        </h3>
                                        {conversation.unread > 0 && (
                                            <Chip
                                                size="sm"
                                                color="primary"
                                                variant="solid"
                                                className="h-5 min-w-5 px-1"
                                            >
                                                {conversation.unread}
                                            </Chip>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-600 truncate mb-1">
                                        {conversation.lastMessage}
                                    </p>
                                    <p className="text-xs text-gray-400">{conversation.timestamp}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollShadow>
            </div>

            {/* Chat Area - Right Side */}
            <div className="flex-1 flex flex-col bg-white">
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Badge
                            content=""
                            color={selectedConversation?.online ? "success" : "default"}
                            shape="circle"
                            placement="bottom-right"
                            size="sm"
                            showOutline={false}
                            isInvisible={!selectedConversation?.online}
                        >
                            <Avatar
                                name={selectedConversation?.clientAvatar || ''}
                                size="md"
                                color="primary"
                                isBordered
                            />
                        </Badge>
                        <div>
                            <h2 className="font-semibold text-gray-900">
                                {selectedConversation?.clientName}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {selectedConversation?.online ? "En línea" : "Desconectado"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            isIconOnly
                            variant="light"
                            className="text-gray-600"
                            size="sm"
                        >
                            <Icon icon="solar:menu-dots-linear" width={20} />
                        </Button>
                    </div>
                </div>

                {/* Messages Area */}
                <ScrollShadow className="flex-1 p-4 overflow-y-auto bg-gray-50">
                    <div className="space-y-4 max-w-4xl mx-auto">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex gap-3 ${message.isOwn ? "flex-row-reverse" : "flex-row"}`}
                            >
                                {!message.isOwn && (
                                    <Avatar
                                        name={selectedConversation?.clientAvatar || ''}
                                        size="sm"
                                        color="primary"
                                        className="flex-shrink-0"
                                    />
                                )}
                                <div
                                    className={`flex flex-col gap-1 max-w-[70%] ${message.isOwn ? "items-end" : "items-start"}`}
                                >
                                    <Card
                                        className={`
                                            ${message.isOwn
                                                ? "bg-blue-600 text-white"
                                                : "bg-white text-gray-900"
                                            }
                                            shadow-sm
                                        `}
                                    >
                                        <CardBody className="p-3">
                                            <p className="text-sm leading-relaxed">{message.content}</p>
                                        </CardBody>
                                    </Card>
                                    <p
                                        className={`text-xs text-gray-400 px-1 ${message.isOwn ? "text-right" : "text-left"}`}
                                    >
                                        {message.timestamp}
                                    </p>
                                </div>
                                {message.isOwn && (
                                    <Avatar
                                        name="TC"
                                        size="sm"
                                        color="success"
                                        className="flex-shrink-0"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollShadow>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-end gap-2">
                            <Button
                                isIconOnly
                                variant="light"
                                className="text-gray-600 mb-1"
                                size="sm"
                            >
                                <Icon icon="solar:paperclip-linear" width={20} />
                            </Button>
                            <Button
                                isIconOnly
                                variant="light"
                                className="text-gray-600 mb-1"
                                size="sm"
                            >
                                <Icon icon="solar:gallery-linear" width={20} />
                            </Button>
                            <Input
                                placeholder="Escribe un mensaje..."
                                variant="bordered"
                                size="lg"
                                classNames={{
                                    input: "text-sm",
                                    inputWrapper: "border-gray-200 bg-gray-50",
                                }}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e?.preventDefault?.();
                                        handleSendMessage();
                                    }
                                }}
                                endContent={
                                    <Button
                                        isIconOnly
                                        variant="light"
                                        className="text-gray-600"
                                        size="sm"
                                    >
                                        <Icon icon="solar:smile-circle-linear" width={20} />
                                    </Button>
                                }
                            />
                            <Button
                                isIconOnly
                                color="primary"
                                size="lg"
                                className="flex-shrink-0"
                                onPress={handleSendMessage}
                                isDisabled={newMessage.trim() === ""}
                            >
                                <Icon icon="solar:plain-2-bold" width={20} />
                            </Button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-center">
                            Presiona Enter para enviar, Shift + Enter para nueva línea
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

