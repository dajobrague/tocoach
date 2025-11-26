"use client";

import { Button, Card, CardBody, Input, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import AddSupplementModal from "./add-supplement-modal";
import EditSupplementModal from "./edit-supplement-modal";

import { SupplementInventoryItem } from "@/types/supplements";

export default function InventoryContent() {
  const [inventory, setInventory] = useState<SupplementInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplement, setEditingSupplement] =
    useState<SupplementInventoryItem | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  // Fetch inventory
  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/supplements/inventory?include_archived=${includeArchived}`
      );
      const result = await response.json();

      if (result.success) {
        setInventory(result.data);
      } else {
        console.error("Error fetching inventory:", result.error);
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [includeArchived]);

  // Filter inventory by search query
  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description &&
        item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Handle archive/unarchive
  const handleToggleArchive = async (
    supplementId: string,
    currentArchiveStatus: boolean
  ) => {
    try {
      const response = await fetch(
        `/api/supplements/inventory/${supplementId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_archived: !currentArchiveStatus }),
        }
      );

      const result = await response.json();

      if (result.success) {
        fetchInventory();
      } else {
        console.error("Error toggling archive status:", result.error);
      }
    } catch (error) {
      console.error("Error toggling archive status:", error);
    }
  };

  // Handle delete (archive)
  const handleDelete = async (supplementId: string) => {
    if (
      !confirm(
        "¿Estás seguro de que quieres archivar este suplemento? Las asignaciones existentes seguirán activas."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/supplements/inventory/${supplementId}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (result.success) {
        fetchInventory();
      } else {
        console.error("Error archiving supplement:", result.error);
      }
    } catch (error) {
      console.error("Error archiving supplement:", error);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Inventario de Suplementos
            </h1>
            <p className="text-gray-500 mt-1">
              Gestiona tu catálogo de suplementos
            </p>
          </div>
          <Button
            className="text-white font-semibold"
            color="primary"
            size="lg"
            startContent={<Icon icon="solar:add-circle-bold" width={20} />}
            onPress={() => setIsAddModalOpen(true)}
          >
            Añadir Suplemento
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            className="flex-1"
            classNames={{
              input: "text-sm",
              inputWrapper: "h-12",
            }}
            placeholder="Buscar suplementos..."
            startContent={
              <Icon
                className="text-gray-400"
                icon="solar:magnifer-linear"
                width={20}
              />
            }
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <Button
            className="font-medium"
            color={includeArchived ? "primary" : "default"}
            startContent={<Icon icon="solar:archive-linear" width={20} />}
            variant={includeArchived ? "solid" : "bordered"}
            onPress={() => setIncludeArchived(!includeArchived)}
          >
            {includeArchived ? "Ocultar archivados" : "Mostrar archivados"}
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border border-blue-100 mb-6">
        <CardBody className="p-5">
          <div className="flex items-start gap-3">
            <Icon
              className="text-blue-600 mt-0.5 flex-shrink-0"
              icon="solar:info-circle-bold"
              width={20}
            />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Inventario Centralizado
              </p>
              <p className="text-sm text-blue-700">
                Añade suplementos aquí una vez y asígnalos a múltiples clientes
                sin tener que volver a escribir la información.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Inventory Grid */}
      {!isLoading && filteredInventory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInventory.map((item) => (
            <Card
              key={item.id}
              className={`bg-white border shadow-sm hover:shadow-md transition-shadow ${
                item.is_archived
                  ? "border-gray-300 opacity-60"
                  : "border-gray-200"
              }`}
            >
              <CardBody className="p-5">
                {/* Header with Image */}
                <div className="flex items-start gap-4 mb-4">
                  {/* Image Thumbnail */}
                  <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                    {item.images && item.images.length > 0 ? (
                      <img
                        alt={item.name}
                        className="w-full h-full object-cover"
                        src={item.images[0]}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon
                          className="text-gray-400 text-3xl"
                          icon="solar:box-linear"
                        />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-gray-900 truncate">
                        {item.name}
                        {item.is_archived && (
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            (Archivado)
                          </span>
                        )}
                      </h3>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => setEditingSupplement(item)}
                        >
                          <Icon
                            className="text-gray-600"
                            icon="solar:pen-linear"
                            width={18}
                          />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() =>
                            handleToggleArchive(item.id, item.is_archived)
                          }
                        >
                          <Icon
                            className="text-gray-600"
                            icon={
                              item.is_archived
                                ? "solar:restart-linear"
                                : "solar:archive-linear"
                            }
                            width={18}
                          />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {item.quantity} {item.unit}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {item.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                    {item.description}
                  </p>
                )}

                {/* Image Gallery Preview */}
                {item.images && item.images.length > 1 && (
                  <div className="flex gap-2 mt-3">
                    {item.images.slice(1, 4).map((img, idx) => (
                      <div
                        key={idx}
                        className="w-12 h-12 bg-gray-100 rounded overflow-hidden"
                      >
                        <img
                          alt={`${item.name} ${idx + 2}`}
                          className="w-full h-full object-cover"
                          src={img}
                        />
                      </div>
                    ))}
                    {item.images.length > 4 && (
                      <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-xs text-gray-600 font-medium">
                          +{item.images.length - 4}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredInventory.length === 0 && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <Icon
                  className="text-gray-400 text-5xl"
                  icon="solar:box-linear"
                />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery
                  ? "No se encontraron suplementos"
                  : "No hay suplementos en el inventario"}
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                {searchQuery
                  ? "Intenta con otro término de búsqueda"
                  : "Añade tu primer suplemento al inventario para empezar"}
              </p>
              {!searchQuery && (
                <Button
                  className="text-white font-semibold"
                  color="primary"
                  startContent={
                    <Icon icon="solar:add-circle-bold" width={20} />
                  }
                  onPress={() => setIsAddModalOpen(true)}
                >
                  Añadir Suplemento
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Add Supplement Modal */}
      <AddSupplementModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchInventory}
      />

      {/* Edit Supplement Modal */}
      {editingSupplement && (
        <EditSupplementModal
          isOpen={true}
          supplement={editingSupplement}
          onClose={() => setEditingSupplement(null)}
          onSuccess={fetchInventory}
        />
      )}
    </div>
  );
}
