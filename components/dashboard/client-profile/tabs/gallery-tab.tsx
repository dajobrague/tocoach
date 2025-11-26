"use client";

import {
  Button,
  Card,
  CardBody,
  Image,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import {
  getMockProgressPhotos,
  MockProgressPhoto,
} from "@/lib/mock-data/client-profile-mock";

interface GalleryTabProps {
  clientId: string;
}

export default function GalleryTab({ clientId }: GalleryTabProps) {
  const photoSessions = getMockProgressPhotos(clientId);
  const [selectedPhoto, setSelectedPhoto] = useState<MockProgressPhoto | null>(
    null
  );
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [compareMode, setCompareMode] = useState(false);
  const [comparePhotos, setComparePhotos] = useState<{
    first: string;
    second: string;
  }>({
    first: photoSessions[0]?.id || "",
    second: photoSessions[1]?.id || "",
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getAngleIcon = (angle: string) => {
    switch (angle) {
      case "front":
        return "solar:user-bold";
      case "side":
        return "solar:user-hand-up-bold";
      case "back":
        return "solar:user-linear";
      default:
        return "solar:camera-bold";
    }
  };

  const getAngleLabel = (angle: string) => {
    switch (angle) {
      case "front":
        return "Frontal";
      case "side":
        return "Lateral";
      case "back":
        return "Espalda";
      default:
        return angle;
    }
  };

  const handlePhotoClick = (photo: MockProgressPhoto) => {
    setSelectedPhoto(photo);
    onOpen();
  };

  const latestSession = photoSessions[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Galería de Progreso
        </h2>
        <div className="flex gap-2">
          <Button
            color={compareMode ? "primary" : "default"}
            startContent={
              <Icon icon="solar:gallery-minimalistic-bold" width={20} />
            }
            variant="flat"
            onPress={() => setCompareMode(!compareMode)}
          >
            {compareMode ? "Modo Normal" : "Comparar"}
          </Button>
          <Button
            className="text-white font-semibold"
            color="primary"
            startContent={<Icon icon="solar:add-circle-bold" width={20} />}
          >
            Subir Fotos
          </Button>
        </div>
      </div>

      {/* Compare Mode */}
      {compareMode && (
        <Card className="bg-blue-50 border border-blue-200">
          <CardBody className="p-6">
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              <Icon
                className="text-blue-600"
                icon="solar:gallery-minimalistic-bold"
                width={20}
              />
              Vista Comparativa
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Selection */}
              <div>
                <label className="text-sm font-semibold text-blue-900 mb-2 block">
                  Primera fecha
                </label>
                <select
                  className="w-full p-2 rounded-lg border border-blue-200 bg-white mb-4"
                  value={comparePhotos.first}
                  onChange={(e) =>
                    setComparePhotos({
                      ...comparePhotos,
                      first: e.target.value,
                    })
                  }
                >
                  {photoSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {formatDate(session.date)}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-3 gap-2">
                  {photoSessions
                    .find((s) => s.id === comparePhotos.first)
                    ?.photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <Image
                          alt={getAngleLabel(photo.angle)}
                          className="w-full aspect-[3/4] object-cover rounded-lg"
                          src={photo.url}
                        />
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                          {getAngleLabel(photo.angle)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Second Selection */}
              <div>
                <label className="text-sm font-semibold text-blue-900 mb-2 block">
                  Segunda fecha
                </label>
                <select
                  className="w-full p-2 rounded-lg border border-blue-200 bg-white mb-4"
                  value={comparePhotos.second}
                  onChange={(e) =>
                    setComparePhotos({
                      ...comparePhotos,
                      second: e.target.value,
                    })
                  }
                >
                  {photoSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {formatDate(session.date)}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-3 gap-2">
                  {photoSessions
                    .find((s) => s.id === comparePhotos.second)
                    ?.photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <Image
                          alt={getAngleLabel(photo.angle)}
                          className="w-full aspect-[3/4] object-cover rounded-lg"
                          src={photo.url}
                        />
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                          {getAngleLabel(photo.angle)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Latest Session - Featured */}
      {!compareMode && latestSession && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Última Sesión de Fotos
                </h3>
                <p className="text-sm text-gray-600">
                  {formatDate(latestSession.date)}
                </p>
              </div>
              <Button
                size="sm"
                startContent={<Icon icon="solar:download-linear" width={18} />}
                variant="flat"
              >
                Descargar Todo
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {latestSession.photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group cursor-pointer"
                  onClick={() => handlePhotoClick(photo)}
                >
                  <Image
                    alt={getAngleLabel(photo.angle)}
                    className="w-full aspect-[3/4] object-cover rounded-lg"
                    src={photo.url}
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <Icon
                      className="text-white text-4xl"
                      icon="solar:eye-bold"
                    />
                  </div>
                  {/* Angle Badge */}
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <Icon
                      className="text-blue-600"
                      icon={getAngleIcon(photo.angle)}
                      width={18}
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      {getAngleLabel(photo.angle)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            {latestSession.photos.some((p) => p.notes) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                {latestSession.photos
                  .filter((p) => p.notes)
                  .map((photo) => (
                    <div
                      key={photo.id}
                      className="p-3 bg-blue-50 rounded-lg border border-blue-100 mb-2 last:mb-0"
                    >
                      <div className="flex items-start gap-2">
                        <Icon
                          className="text-blue-600 mt-0.5 flex-shrink-0"
                          icon="solar:clipboard-text-bold"
                          width={16}
                        />
                        <div>
                          <p className="text-xs text-blue-600 font-medium mb-0.5">
                            {getAngleLabel(photo.angle)}
                          </p>
                          <p className="text-sm text-blue-900">{photo.notes}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* History - All Sessions */}
      {!compareMode && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Historial ({photoSessions.length} sesiones)
          </h3>
          <div className="space-y-4">
            {photoSessions.slice(1).map((session) => (
              <Card
                key={session.id}
                className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <CardBody className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {formatDate(session.date)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {session.photos.length} fotos
                      </p>
                    </div>
                    <Button
                      size="sm"
                      startContent={
                        <Icon icon="solar:download-linear" width={16} />
                      }
                      variant="flat"
                    >
                      Descargar
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {session.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative group cursor-pointer"
                        onClick={() => handlePhotoClick(photo)}
                      >
                        <Image
                          alt={getAngleLabel(photo.angle)}
                          className="w-full aspect-[3/4] object-cover rounded-lg"
                          src={photo.url}
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <Icon
                            className="text-white text-2xl"
                            icon="solar:eye-bold"
                          />
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                          {getAngleLabel(photo.angle)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {photoSessions.length === 0 && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <Icon
                  className="text-gray-400 text-5xl"
                  icon="solar:camera-linear"
                />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay fotos de progreso
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Sube las primeras fotos para comenzar a trackear el progreso
                visual
              </p>
              <Button
                className="text-white font-semibold"
                color="primary"
                startContent={<Icon icon="solar:add-circle-bold" width={20} />}
              >
                Subir Fotos
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Photo Detail Modal */}
      <Modal isOpen={isOpen} size="2xl" onClose={onClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            {selectedPhoto && (
              <>
                <h3 className="text-xl font-bold">
                  {getAngleLabel(selectedPhoto.angle)}
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  {formatDate(selectedPhoto.date)}
                </p>
              </>
            )}
          </ModalHeader>
          <ModalBody className="pb-6">
            {selectedPhoto && (
              <div>
                <Image
                  alt={getAngleLabel(selectedPhoto.angle)}
                  className="w-full rounded-lg"
                  src={selectedPhoto.url}
                />
                {selectedPhoto.notes && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-start gap-2">
                      <Icon
                        className="text-blue-600 mt-0.5"
                        icon="solar:clipboard-text-bold"
                        width={18}
                      />
                      <div>
                        <p className="text-sm font-semibold text-blue-900 mb-1">
                          Notas
                        </p>
                        <p className="text-sm text-blue-700">
                          {selectedPhoto.notes}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
