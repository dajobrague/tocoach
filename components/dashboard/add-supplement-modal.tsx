"use client";

import {
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface AddSupplementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddSupplementModal({
  isOpen,
  onClose,
  onSuccess,
}: AddSupplementModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    product_url: "",
  });
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageUpload = async (file: File, tempSupplementId: string) => {
    const formData = new FormData();

    formData.append("image", file);
    formData.append("supplement_id", tempSupplementId);

    const response = await fetch("/api/supplements/upload-image", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Error al subir imagen");
    }

    return result.imageUrl;
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;

    if (!files || files.length === 0) return;

    if (images.length + files.length > 5) {
      alert("Máximo 5 imágenes por producto");

      return;
    }

    setUploadingImage(true);

    try {
      // Create temp supplement ID for organizing uploads
      const tempId = `temp-${Date.now()}`;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imageUrl = await handleImageUpload(file, tempId);

        setImages((prev) => [...prev, imageUrl]);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Error al subir imagen. Por favor intenta de nuevo.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async (imageUrl: string) => {
    try {
      await fetch("/api/supplements/upload-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      setImages((prev) => prev.filter((img) => img !== imageUrl));
    } catch (error) {
      console.error("Error removing image:", error);
      alert("Error al eliminar imagen");
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name) {
      alert("Por favor completa todos los campos requeridos");

      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/supplements/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          images,
        }),
      });

      const result = await response.json();

      if (result.success) {
        onSuccess();
        handleClose();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error creating supplement:", error);
      alert("Error al crear suplemento. Por favor intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: "", description: "", product_url: "" });
    setImages([]);
    onClose();
  };

  return (
    <Modal
      classNames={{
        base: "max-h-[90vh]",
        header: "border-b border-gray-200",
        footer: "border-t border-gray-200",
        body: "py-6",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="3xl"
      onClose={handleClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 p-2 rounded-lg">
              <Icon className="text-blue-600 text-xl" icon="solar:box-linear" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Añadir Suplemento al Inventario
              </h3>
              <p className="text-sm text-gray-500 font-normal">
                Completa la información del producto
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-6">
            {/* Basic Information */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Icon
                  className="text-blue-600"
                  icon="solar:box-linear"
                  width={18}
                />
                Información del Producto
              </h4>
              <div className="space-y-4">
                <Input
                  isRequired
                  label="Nombre del Producto"
                  placeholder="Ej: Creatina Monohidrato"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:health-bold"
                      width={18}
                    />
                  }
                  value={formData.name}
                  onValueChange={(value) =>
                    setFormData({ ...formData, name: value })
                  }
                />
                <Textarea
                  label="Descripción"
                  minRows={3}
                  placeholder="Describe el producto, marca, beneficios..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:notes-linear"
                      width={18}
                    />
                  }
                  value={formData.description}
                  onValueChange={(value) =>
                    setFormData({ ...formData, description: value })
                  }
                />
                <Input
                  label="URL del Producto"
                  placeholder="https://ejemplo.com/producto"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:link-linear"
                      width={18}
                    />
                  }
                  type="url"
                  value={formData.product_url}
                  onValueChange={(value) =>
                    setFormData({ ...formData, product_url: value })
                  }
                />
              </div>
            </div>

            {/* Images Section */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Icon
                  className="text-blue-600"
                  icon="solar:gallery-linear"
                  width={18}
                />
                Imágenes del Producto (Máximo 5)
              </h4>

              {/* Image Grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {images.map((imageUrl, index) => (
                    <div
                      key={index}
                      className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100"
                    >
                      <img
                        alt={`Producto ${index + 1}`}
                        className="w-full h-full object-cover"
                        src={imageUrl}
                      />
                      <Button
                        isIconOnly
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        color="danger"
                        size="sm"
                        variant="solid"
                        onPress={() => handleRemoveImage(imageUrl)}
                      >
                        <Icon icon="solar:trash-bin-minimalistic-bold" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              {images.length < 5 && (
                <label className="block">
                  <input
                    multiple
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    disabled={uploadingImage}
                    type="file"
                    onChange={handleFileSelect}
                  />
                  <Button
                    as="span"
                    className="w-full"
                    color="default"
                    isLoading={uploadingImage}
                    startContent={
                      !uploadingImage && (
                        <Icon icon="solar:upload-linear" width={20} />
                      )
                    }
                    variant="bordered"
                  >
                    {uploadingImage
                      ? "Subiendo..."
                      : images.length === 0
                        ? "Subir Imágenes"
                        : "Agregar Más Imágenes"}
                  </Button>
                </label>
              )}
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 border border-blue-100">
              <CardBody className="p-4">
                <div className="flex items-start gap-2">
                  <Icon
                    className="text-blue-600 mt-0.5 flex-shrink-0"
                    icon="solar:info-circle-bold"
                    width={18}
                  />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">
                      Consejo
                    </p>
                    <p className="text-sm text-blue-700">
                      Añade imágenes claras del producto y un enlace de compra
                      para facilitar su identificación y adquisición.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={isSubmitting}
            variant="light"
            onPress={handleClose}
          >
            Cancelar
          </Button>
          <Button
            className="text-white font-semibold"
            color="primary"
            isLoading={isSubmitting}
            startContent={<Icon icon="solar:add-circle-bold" width={18} />}
            onPress={handleSubmit}
          >
            Añadir al Inventario
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
