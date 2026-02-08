"use client";

import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Tab,
  Tabs,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import CreateTemplateModal from "./create-template-modal";
import TemplateDetailModal from "./template-detail-modal";

interface Template {
  id: string;
  name: string;
  description?: string;
  templateType: "program" | "nutrition";
  type?: string;
  category: "cardio" | "strength" | "nutrition";
  division?: string;
  goal?: string;
  sessionsPerWeek?: number;
  sessionCount?: number;
  exerciseCount?: number;
  dayCount?: number;
  mealCount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesContent() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [templateTypeTab, setTemplateTypeTab] = useState<
    "programs" | "nutrition"
  >("programs");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "cardio" | "strength"
  >("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );

  // Fetch templates
  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();

      // Filter by template type
      params.append("type", templateTypeTab);
      // Filter by category only for programs
      if (templateTypeTab === "programs" && categoryFilter !== "all") {
        params.append("category", categoryFilter);
      }
      const response = await fetch(`/api/templates?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setTemplates(result.templates);
      } else {
        console.error("Error fetching templates:", result.error);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [templateTypeTab, categoryFilter]);

  // Filter templates by search query
  const filteredTemplates = templates.filter(
    (template) =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.description &&
        template.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Handle delete template
  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;

    setIsDeleting(true);
    try {
      let endpoint = "";

      if (templateToDelete.templateType === "nutrition") {
        endpoint = `/api/nutrition/plans/${templateToDelete.id}`;
      } else {
        endpoint = `/api/templates/${templateToDelete.id}`;
      }

      const response = await fetch(endpoint, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        fetchTemplates();
      } else {
        console.error("Error deleting template:", result.error);
        alert("Error al eliminar la plantilla");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Error al eliminar la plantilla");
    } finally {
      setIsDeleting(false);
      setTemplateToDelete(null);
    }
  };

  // Handle view/edit template
  const handleViewTemplate = (template: Template) => {
    setSelectedTemplate(template);
  };

  // Get category color
  const getCategoryColor = (category: "cardio" | "strength" | "nutrition") => {
    if (category === "cardio") return "danger";
    if (category === "nutrition") return "success";

    return "primary";
  };

  // Get category icon
  const getCategoryIcon = (template: Template) => {
    if (template.templateType === "nutrition") return "fluent:food-20-filled";
    if (template.category === "cardio") return "solar:fire-bold";

    return "solar:dumbbell-linear";
  };

  // Get category label
  const getCategoryLabel = (category: "cardio" | "strength" | "nutrition") => {
    if (category === "cardio") return "Cardio";
    if (category === "nutrition") return "Nutrición";

    return "Fuerza";
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Plantillas
            </h1>
            <p className="text-gray-500 mt-1">
              Crea y gestiona plantillas para programas de entrenamiento y
              nutrición
            </p>
          </div>
          <Button
            className="bg-black text-white hover:bg-slate-800 font-semibold"
            size="lg"
            startContent={<Icon icon="solar:add-circle-bold" width={20} />}
            onPress={() => setIsCreateModalOpen(true)}
          >
            Crear Plantilla
          </Button>
        </div>

        {/* Template Type Tabs */}
        <Tabs
          classNames={{
            tabList: "gap-6",
            cursor: "bg-black",
            tab: "h-12",
            tabContent: "group-data-[selected=true]:text-black",
          }}
          selectedKey={templateTypeTab}
          variant="underlined"
          onSelectionChange={(key) => {
            setTemplateTypeTab(key as "programs" | "nutrition");
            setCategoryFilter("all");
          }}
        >
          <Tab
            key="programs"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:dumbbell-bold" width={20} />
                <span className="font-medium">Programas de Entrenamiento</span>
              </div>
            }
          />
          <Tab
            key="nutrition"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="fluent:food-20-filled" width={20} />
                <span className="font-medium">Planes Nutricionales</span>
              </div>
            }
          />
        </Tabs>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            className="flex-1"
            classNames={{
              input: "text-sm",
              inputWrapper: "h-12",
            }}
            placeholder="Buscar plantillas..."
            startContent={
              <Icon
                className="text-gray-400"
                icon="solar:magnifer-linear"
                width={20}
              />
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Category Filter - Only show for programs */}
          {templateTypeTab === "programs" && (
            <div className="flex gap-2">
              <Button
                className="bg-black text-white hover:bg-slate-800 font-semibold"
                variant={categoryFilter === "all" ? "solid" : "flat"}
                onPress={() => setCategoryFilter("all")}
              >
                Todas
              </Button>
              <Button
                className="bg-black text-white hover:bg-slate-800 font-semibold"
                variant={categoryFilter === "strength" ? "solid" : "flat"}
                onPress={() => setCategoryFilter("strength")}
              >
                Fuerza
              </Button>
              <Button
                className="bg-black text-white hover:bg-slate-800 font-semibold"
                variant={categoryFilter === "cardio" ? "solid" : "flat"}
                onPress={() => setCategoryFilter("cardio")}
              >
                Cardio
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Spinner size="lg" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-20">
          <Icon
            className="mx-auto text-gray-300 mb-4"
            icon="solar:folder-with-files-linear"
            width={80}
          />
          <p className="text-gray-500 text-lg mb-2">
            {searchQuery
              ? "No se encontraron plantillas"
              : "No tienes plantillas aún"}
          </p>
          <p className="text-gray-400 mb-6">
            {searchQuery
              ? "Intenta con otra búsqueda"
              : "Crea tu primera plantilla para agilizar la creación de programas"}
          </p>
          {!searchQuery && templateTypeTab === "programs" && (
            <Button
              className="text-white font-semibold"
              color="primary"
              size="lg"
              startContent={<Icon icon="solar:add-circle-bold" width={20} />}
              onPress={() => setIsCreateModalOpen(true)}
            >
              Crear Plantilla
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="hover:shadow-lg transition-shadow h-full"
            >
              <CardBody className="p-5 flex flex-col h-full">
                {/* Header Section - Fixed Height */}
                <div className="flex justify-between items-start mb-3 min-h-[80px]">
                  <div className="flex-1 mr-2">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                      {template.name}
                    </h3>
                    <div className="min-h-[40px]">
                      {template.description && (
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Chip
                    className="ml-2 flex-shrink-0"
                    classNames={{
                      content: "text-white font-semibold",
                    }}
                    color={getCategoryColor(template.category)}
                    size="sm"
                    startContent={
                      <Icon
                        className="text-white"
                        icon={getCategoryIcon(template)}
                        width={16}
                      />
                    }
                    variant="solid"
                  >
                    {getCategoryLabel(template.category)}
                  </Chip>
                </div>

                {/* Template Details - Fixed Height */}
                <div className="space-y-2 mb-4 min-h-[90px]">
                  {template.templateType === "nutrition" ? (
                    <>
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon
                          className="mr-2 text-gray-400"
                          icon="solar:calendar-linear"
                          width={16}
                        />
                        <span>{template.dayCount || 0} días</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon
                          className="mr-2 text-gray-400"
                          icon="fluent:food-20-filled"
                          width={16}
                        />
                        <span>{template.mealCount || 0} comidas</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon
                          className="mr-2 text-gray-400"
                          icon={getCategoryIcon(template)}
                          width={16}
                        />
                        <span>{template.type}</span>
                        {template.division && (
                          <span className="ml-2 text-gray-400">
                            • {template.division}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon
                          className="mr-2 text-gray-400"
                          icon="solar:calendar-linear"
                          width={16}
                        />
                        <span>{template.sessionCount || 0} sesiones</span>
                        <span className="mx-2">•</span>
                        <span>{template.exerciseCount || 0} ejercicios</span>
                      </div>
                      {template.sessionsPerWeek && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Icon
                            className="mr-2 text-gray-400"
                            icon="solar:calendar-mark-linear"
                            width={16}
                          />
                          <span>
                            {template.sessionsPerWeek} sesiones/semana
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Actions - Pushed to bottom */}
                <div className="mt-auto pt-4 border-t border-gray-100">
                  <div className="flex gap-2 mb-3">
                    <Button
                      className="flex-1 bg-black text-white hover:bg-slate-800 font-semibold"
                      size="sm"
                      variant="flat"
                      onPress={() => handleViewTemplate(template)}
                    >
                      Ver/Editar
                    </Button>
                    <Button
                      isIconOnly
                      color="danger"
                      size="sm"
                      variant="solid"
                      onPress={() => setTemplateToDelete(template)}
                    >
                      <Icon
                        className="text-white"
                        icon="solar:trash-bin-trash-bold"
                        width={18}
                      />
                    </Button>
                  </div>

                  {/* Last Updated */}
                  <p className="text-xs text-gray-400">
                    Actualizado:{" "}
                    {new Date(template.updatedAt).toLocaleDateString("es")}
                  </p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      <CreateTemplateModal
        defaultType={templateTypeTab === "nutrition" ? "nutrition" : "program"}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          fetchTemplates();
        }}
      />

      {/* Template Detail Modal */}
      {selectedTemplate && (
        <TemplateDetailModal
          isOpen={!!selectedTemplate}
          template={selectedTemplate}
          onClose={(updatedData) => {
            if (updatedData) {
              // Optimistically update the local templates list with the changes
              setTemplates((prev) =>
                prev.map((t) => {
                  if (t.id !== selectedTemplate.id) return t;
                  const updated: Template = {
                    ...t,
                    name: updatedData.name,
                    category: updatedData.category,
                    updatedAt: new Date().toISOString(),
                  };
                  if (updatedData.description !== undefined) updated.description = updatedData.description;
                  if (updatedData.type !== undefined) updated.type = updatedData.type;
                  if (updatedData.division !== undefined) updated.division = updatedData.division;
                  if (updatedData.goal !== undefined) updated.goal = updatedData.goal;
                  if (updatedData.sessionsPerWeek !== undefined) updated.sessionsPerWeek = updatedData.sessionsPerWeek;
                  const sc = updatedData.sessionCount ?? t.sessionCount;
                  if (sc !== undefined) updated.sessionCount = sc;
                  const ec = updatedData.exerciseCount ?? t.exerciseCount;
                  if (ec !== undefined) updated.exerciseCount = ec;
                  const dc = updatedData.dayCount ?? t.dayCount;
                  if (dc !== undefined) updated.dayCount = dc;
                  const mc = updatedData.mealCount ?? t.mealCount;
                  if (mc !== undefined) updated.mealCount = mc;
                  return updated;
                })
              );
            }
            setSelectedTemplate(null);
          }}
          onSuccess={() => {
            // No-op: updates are handled via onClose
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!templateToDelete}
        size="sm"
        onClose={() => setTemplateToDelete(null)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-full">
                <Icon className="text-red-600" icon="solar:trash-bin-trash-bold" width={20} />
              </div>
              <span>Eliminar Plantilla</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <p className="text-gray-700">
              ¿Estás seguro de que quieres eliminar{" "}
              <span className="font-semibold">&quot;{templateToDelete?.name}&quot;</span>?
            </p>
            <p className="text-sm text-gray-500">
              Esta acción no se puede deshacer.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => setTemplateToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              color="danger"
              isLoading={isDeleting}
              onPress={handleConfirmDelete}
            >
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
