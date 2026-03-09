"use client";

import type {
  FormConfigData,
  FormPage,
  QuestionConfig,
  QuestionType,
} from "@/lib/forms/types";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Switch,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { IconPicker } from "@/components/ui/icon-picker";
import { normalizeFormConfig } from "@/lib/forms/types";

// ── Sortable wrapper ──────────────────────────────────────────────────
function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (props: {
    dragHandleProps: Record<string, any>;
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: { ...attributes, ...listeners },
        isDragging,
      })}
    </div>
  );
}

// ── Type helpers ──────────────────────────────────────────────────────
const TYPE_LABELS: Record<QuestionType, string> = {
  rating: "Valoración",
  number: "Número",
  text: "Texto",
  boolean: "Sí/No",
  photo: "Foto",
  group: "Grupo",
};

const TYPE_CHIP_STYLES: Record<QuestionType, string> = {
  rating: "bg-amber-100 text-amber-800",
  number: "bg-blue-100 text-blue-800",
  text: "bg-gray-100 text-gray-700",
  boolean: "bg-emerald-100 text-emerald-800",
  photo: "bg-purple-100 text-purple-800",
  group: "bg-orange-100 text-orange-800",
};

// ── Props ─────────────────────────────────────────────────────────────
interface FormConfigEditorProps {
  initialConfig: QuestionConfig[] | FormConfigData;
  onChange: (config: FormConfigData) => void;
  /** Called with true when there are unsaved changes, false when clean */
  onDirtyChange?: (dirty: boolean) => void;
  /** Called after a question is added (e.g. to show save reminder toast) */
  onQuestionAdded?: () => void;
}

export default function FormConfigEditor({
  initialConfig,
  onChange,
  onDirtyChange,
  onQuestionAdded,
}: FormConfigEditorProps) {
  // Normalize once and keep as "saved" snapshot
  const savedRef = useRef<FormConfigData>(normalizeFormConfig(initialConfig));
  const [config, setConfig] = useState<FormConfigData>(() => savedRef.current);
  const [selectedPageId, setSelectedPageId] = useState<string>(
    () => config.pages[0]?.id || "default"
  );

  // Dirty tracking
  const [isDirty, setIsDirty] = useState(false);

  const markDirty = useCallback(() => {
    if (!isDirty) {
      setIsDirty(true);
      onDirtyChange?.(true);
    }
  }, [isDirty, onDirtyChange]);

  /** Mark clean (called after parent saves) */
  const markClean = useCallback(() => {
    setIsDirty(false);
    onDirtyChange?.(false);
    savedRef.current = config;
  }, [config, onDirtyChange]);

  // Expose markClean when initialConfig changes (means parent saved)
  useEffect(() => {
    const normalized = normalizeFormConfig(initialConfig);

    savedRef.current = normalized;
    setConfig(normalized);
    setIsDirty(false);
    onDirtyChange?.(false);
  }, [initialConfig]);

  // Expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Editing page title in top header
  const [isEditingPageTitle, setIsEditingPageTitle] = useState(false);
  const [editPageTitle, setEditPageTitle] = useState("");

  // Delete page confirmation
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);

  // Edit question modal
  const [editingQuestion, setEditingQuestion] = useState<{
    id: string;
    label: string;
    fullQuestion: string;
  } | null>(null);

  // Add-question modal
  const {
    isOpen: isAddOpen,
    onOpen: onAddOpen,
    onClose: onAddClose,
  } = useDisclosure();
  const [newQ, setNewQ] = useState({
    label: "",
    fullQuestion: "",
    type: "text" as QuestionType,
    unit: "",
    icon: "solar:question-circle-bold",
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ── Helpers ───────────────────────────────────────────────────────
  const emitChange = useCallback(
    (next: FormConfigData) => {
      setConfig(next);
      onChange(next);
      markDirty();
    },
    [onChange, markDirty]
  );

  const selectedPage = config.pages.find((p) => p.id === selectedPageId);
  const questionsForPage = config.questions.filter(
    (q) => (q.pageId || config.pages[0]?.id) === selectedPageId
  );
  const enabledCount = questionsForPage.filter((q) => q.enabled).length;
  const totalCount = questionsForPage.length;

  // ── Group expand/collapse ─────────────────────────────────────────
  const toggleGroupExpand = (qId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);

      if (next.has(qId)) next.delete(qId);
      else next.add(qId);

      return next;
    });
  };

  // ── Page CRUD ─────────────────────────────────────────────────────
  const addPage = () => {
    const id = `page_${Date.now()}`;
    const newPage: FormPage = {
      id,
      title: `Página ${config.pages.length + 1}`,
      icon: "solar:clipboard-check-bold",
      order: config.pages.length,
    };

    emitChange({ ...config, pages: [...config.pages, newPage] });
    setSelectedPageId(id);
  };

  const deletePage = (pageId: string) => {
    if (config.pages.length <= 1) return;
    const firstOtherPage = config.pages.find((p) => p.id !== pageId);

    if (!firstOtherPage) return;

    emitChange({
      pages: config.pages
        .filter((p) => p.id !== pageId)
        .map((p, i) => ({ ...p, order: i })),
      questions: config.questions.map((q) =>
        q.pageId === pageId ? { ...q, pageId: firstOtherPage.id } : q
      ),
    });
    if (selectedPageId === pageId) setSelectedPageId(firstOtherPage.id);
  };

  const updatePageIcon = (pageId: string, icon: string) => {
    emitChange({
      ...config,
      pages: config.pages.map((p) => (p.id === pageId ? { ...p, icon } : p)),
    });
  };

  const updatePageTitle = (pageId: string, title: string) => {
    emitChange({
      ...config,
      pages: config.pages.map((p) => (p.id === pageId ? { ...p, title } : p)),
    });
  };

  const startEditingPageTitle = () => {
    if (selectedPage) {
      setIsEditingPageTitle(true);
      setEditPageTitle(selectedPage.title);
    }
  };

  const commitPageTitleEdit = () => {
    if (selectedPage && editPageTitle.trim()) {
      updatePageTitle(selectedPage.id, editPageTitle.trim());
    }
    setIsEditingPageTitle(false);
  };

  // ── Question CRUD ─────────────────────────────────────────────────
  const toggleQuestion = (qId: string, field: "enabled" | "required") => {
    emitChange({
      ...config,
      questions: config.questions.map((q) =>
        q.id === qId ? { ...q, [field]: !q[field] } : q
      ),
    });
  };

  const toggleSubQuestion = (
    parentId: string,
    subId: string,
    field: "enabled" | "required"
  ) => {
    emitChange({
      ...config,
      questions: config.questions.map((q) => {
        if (q.id === parentId && q.subQuestions) {
          return {
            ...q,
            subQuestions: q.subQuestions.map((sq) =>
              sq.id === subId ? { ...sq, [field]: !sq[field] } : sq
            ),
          };
        }

        return q;
      }),
    });
  };

  const updateQuestionIcon = (qId: string, icon: string) => {
    emitChange({
      ...config,
      questions: config.questions.map((q) =>
        q.id === qId ? { ...q, icon } : q
      ),
    });
  };

  const updateSubQuestionIcon = (
    parentId: string,
    subId: string,
    icon: string
  ) => {
    emitChange({
      ...config,
      questions: config.questions.map((q) => {
        if (q.id === parentId && q.subQuestions) {
          return {
            ...q,
            subQuestions: q.subQuestions.map((sq) =>
              sq.id === subId ? { ...sq, icon } : sq
            ),
          };
        }

        return q;
      }),
    });
  };

  const moveQuestionToPage = (qId: string, targetPageId: string) => {
    emitChange({
      ...config,
      questions: config.questions.map((q) =>
        q.id === qId ? { ...q, pageId: targetPageId } : q
      ),
    });
  };

  const updateQuestionText = (
    qId: string,
    label: string,
    fullQuestion: string
  ) => {
    emitChange({
      ...config,
      questions: config.questions.map((q) =>
        q.id === qId ? { ...q, label, fullQuestion } : q
      ),
    });
  };

  const confirmDeletePage = () => {
    if (pageToDelete) {
      deletePage(pageToDelete);
      setPageToDelete(null);
    }
  };

  const deleteQuestion = (qId: string) => {
    emitChange({
      ...config,
      questions: config.questions.filter((q) => q.id !== qId),
    });
  };

  const addQuestion = () => {
    if (!newQ.label.trim()) return;

    const unitValue =
      newQ.type === "number" ? newQ.unit.trim() || undefined : undefined;
    const q: QuestionConfig = {
      id: `custom_${Date.now()}`,
      label: newQ.label.trim(),
      fullQuestion: newQ.fullQuestion.trim() || newQ.label.trim(),
      icon: newQ.icon,
      type: newQ.type,
      ...(unitValue !== undefined ? { unit: unitValue } : {}),
      enabled: true,
      required: false,
      pageId: selectedPageId,
    };

    emitChange({ ...config, questions: [...config.questions, q] });
    setNewQ({
      label: "",
      fullQuestion: "",
      type: "text",
      unit: "",
      icon: "solar:question-circle-bold",
    });
    onAddClose();
    onQuestionAdded?.();
  };

  // ── DnD handlers ──────────────────────────────────────────────────
  const handlePageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = config.pages.findIndex((p) => p.id === active.id);
    const newIndex = config.pages.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(config.pages, oldIndex, newIndex).map(
      (p, i) => ({ ...p, order: i })
    );

    emitChange({ ...config, pages: reordered });
  };

  const handleQuestionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const pageQs = questionsForPage;
    const oldIndex = pageQs.findIndex((q) => q.id === active.id);
    const newIndex = pageQs.findIndex((q) => q.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(pageQs, oldIndex, newIndex);
    const otherQs = config.questions.filter(
      (q) => (q.pageId || config.pages[0]?.id) !== selectedPageId
    );

    emitChange({ ...config, questions: [...otherQs, ...reordered] });
  };

  // Other pages (for the move-to dropdown)
  const otherPages = config.pages.filter((p) => p.id !== selectedPageId);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex gap-6 min-h-[420px]">
      {/* ────────────────────────────────────────────────────────────
          LEFT: Pages sidebar (compact, no editing here)
      ──────────────────────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Páginas
          </h4>
          <Button isIconOnly size="sm" variant="light" onPress={addPage}>
            <Icon
              className="text-lg text-gray-600"
              icon="solar:add-circle-linear"
            />
          </Button>
        </div>

        <DndContext
          collisionDetection={closestCenter}
          sensors={sensors}
          onDragEnd={handlePageDragEnd}
        >
          <SortableContext
            items={config.pages.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {config.pages
                .sort((a, b) => a.order - b.order)
                .map((page) => {
                  const isSelected = page.id === selectedPageId;
                  const pageQCount = config.questions.filter(
                    (q) => (q.pageId || config.pages[0]?.id) === page.id
                  ).length;

                  return (
                    <SortableItem key={page.id} id={page.id}>
                      {({ dragHandleProps, isDragging }) => (
                        <div
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-all border ${
                            isSelected
                              ? "bg-white border-gray-300 shadow-sm"
                              : "bg-gray-50 border-transparent hover:bg-gray-100"
                          } ${isDragging ? "shadow-lg" : ""}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedPageId(page.id)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && setSelectedPageId(page.id)
                          }
                        >
                          {/* Drag handle */}
                          <div
                            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0 flex items-center justify-center"
                            {...dragHandleProps}
                          >
                            <Icon
                              icon="solar:hamburger-menu-linear"
                              width={14}
                            />
                          </div>

                          {/* Icon */}
                          <div
                            className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                              isSelected ? "bg-slate-100" : "bg-gray-100"
                            }`}
                          >
                            <Icon
                              className={`text-sm ${isSelected ? "text-gray-800" : "text-gray-500"}`}
                              icon={page.icon}
                            />
                          </div>

                          {/* Title + count */}
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-semibold truncate ${isSelected ? "text-gray-900" : "text-gray-600"}`}
                            >
                              {page.title}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {pageQCount} pregunta
                              {pageQCount !== 1 ? "s" : ""}
                            </p>
                          </div>

                          {/* Delete */}
                          {config.pages.length > 1 && (
                            <button
                              className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors"
                              title="Eliminar página"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPageToDelete(page.id);
                              }}
                            >
                              <Icon
                                icon="solar:trash-bin-2-linear"
                                width={14}
                              />
                            </button>
                          )}
                        </div>
                      )}
                    </SortableItem>
                  );
                })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* ────────────────────────────────────────────────────────────
          RIGHT: Page header + Questions list
      ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* ── Page header (editable icon + title) ────────────────── */}
        <div className="flex items-center justify-between mb-4 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Page icon picker */}
            {selectedPage && (
              <IconPicker
                value={selectedPage.icon}
                onChange={(icon) => updatePageIcon(selectedPage.id, icon)}
              />
            )}

            {/* Page title — click to edit */}
            {isEditingPageTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  classNames={{ input: "text-base font-bold" }}
                  size="sm"
                  value={editPageTitle}
                  variant="underlined"
                  onBlur={commitPageTitleEdit}
                  onKeyDown={(e) => e.key === "Enter" && commitPageTitleEdit()}
                  onValueChange={setEditPageTitle}
                />
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={commitPageTitleEdit}
                >
                  <Icon
                    className="text-emerald-600"
                    icon="solar:check-circle-bold"
                    width={18}
                  />
                </Button>
              </div>
            ) : (
              <div>
                <button
                  className="flex items-center gap-1.5 group cursor-pointer"
                  type="button"
                  onClick={startEditingPageTitle}
                >
                  <h4 className="text-base font-bold text-gray-900 group-hover:text-gray-600 transition-colors">
                    {selectedPage?.title || "General"}
                  </h4>
                  <Icon
                    className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    icon="solar:pen-2-linear"
                    width={14}
                  />
                </button>
                <p className="text-xs text-gray-500">
                  {enabledCount} de {totalCount} preguntas activas
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isDirty && (
              <Chip
                className="flex-shrink-0"
                color="warning"
                size="sm"
                variant="flat"
              >
                Sin guardar
              </Chip>
            )}
            <Button
              className="font-semibold"
              color="primary"
              size="sm"
              startContent={<Icon icon="solar:add-circle-bold" width={18} />}
              variant="flat"
              onPress={onAddOpen}
            >
              Agregar Pregunta
            </Button>
          </div>
        </div>

        {/* ── Questions list ──────────────────────────────────────── */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-0">
            {questionsForPage.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Icon
                    className="text-2xl text-gray-400"
                    icon="solar:clipboard-text-linear"
                  />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  No hay preguntas en esta página
                </p>
                <p className="text-xs text-gray-400 mb-4">
                  Agrega preguntas para que aparezcan en el formulario del
                  cliente
                </p>
                <Button
                  color="primary"
                  size="sm"
                  startContent={
                    <Icon icon="solar:add-circle-bold" width={16} />
                  }
                  variant="flat"
                  onPress={onAddOpen}
                >
                  Agregar primera pregunta
                </Button>
              </div>
            ) : (
              <DndContext
                collisionDetection={closestCenter}
                sensors={sensors}
                onDragEnd={handleQuestionDragEnd}
              >
                <SortableContext
                  items={questionsForPage.map((q) => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="divide-y divide-gray-100">
                    {questionsForPage.map((question) => {
                      const isGroup =
                        question.type === "group" && question.subQuestions;
                      const isExpanded = expandedGroups.has(question.id);

                      return (
                        <SortableItem key={question.id} id={question.id}>
                          {({ dragHandleProps, isDragging }) => (
                            <div
                              className={
                                isDragging ? "bg-blue-50/50 rounded" : ""
                              }
                            >
                              {/* ── Main question row ──────────── */}
                              <div
                                className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                                  question.enabled
                                    ? "hover:bg-gray-50"
                                    : "bg-gray-50/70"
                                }`}
                              >
                                {/* Drag handle */}
                                <div
                                  className="cursor-grab active:cursor-grabbing flex-shrink-0 p-1 rounded hover:bg-gray-100 transition-colors flex items-center justify-center"
                                  title="Arrastra para reordenar"
                                  {...dragHandleProps}
                                >
                                  <Icon
                                    className="text-gray-400"
                                    icon="solar:hamburger-menu-linear"
                                    width={18}
                                  />
                                </div>

                                {/* Icon picker */}
                                <IconPicker
                                  size="sm"
                                  value={question.icon}
                                  onChange={(icon) =>
                                    updateQuestionIcon(question.id, icon)
                                  }
                                />

                                {/* Label + description */}
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={`text-sm font-semibold truncate ${
                                      question.enabled
                                        ? "text-gray-900"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {question.label}
                                  </p>
                                  {question.fullQuestion &&
                                    question.fullQuestion !==
                                      question.label && (
                                      <p
                                        className={`text-xs truncate ${
                                          question.enabled
                                            ? "text-gray-500"
                                            : "text-gray-400"
                                        }`}
                                      >
                                        {question.fullQuestion}
                                      </p>
                                    )}
                                </div>

                                {/* Group expand arrow */}
                                {isGroup && (
                                  <button
                                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors px-2 py-1 rounded-md hover:bg-gray-100 flex-shrink-0"
                                    type="button"
                                    onClick={() =>
                                      toggleGroupExpand(question.id)
                                    }
                                  >
                                    <span className="font-medium">
                                      {question.subQuestions?.length || 0} items
                                    </span>
                                    <Icon
                                      className="text-sm"
                                      icon={
                                        isExpanded
                                          ? "solar:alt-arrow-up-linear"
                                          : "solar:alt-arrow-down-linear"
                                      }
                                    />
                                  </button>
                                )}

                                {/* Type badge */}
                                <span
                                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${TYPE_CHIP_STYLES[question.type]}`}
                                >
                                  {TYPE_LABELS[question.type]}
                                  {question.unit ? ` (${question.unit})` : ""}
                                </span>

                                {/* Required toggle */}
                                {question.enabled &&
                                  !question.conditionalOn && (
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <Switch
                                        classNames={{
                                          wrapper:
                                            "group-data-[selected=true]:!bg-amber-500",
                                        }}
                                        isSelected={question.required}
                                        size="sm"
                                        onValueChange={() =>
                                          toggleQuestion(
                                            question.id,
                                            "required"
                                          )
                                        }
                                      />
                                      <span
                                        className={`text-[11px] font-semibold w-16 ${
                                          question.required
                                            ? "text-amber-700"
                                            : "text-gray-400"
                                        }`}
                                      >
                                        {question.required
                                          ? "★ Oblig."
                                          : "Opcional"}
                                      </span>
                                    </div>
                                  )}

                                {/* Conditional badge */}
                                {question.conditionalOn && (
                                  <Chip
                                    className="flex-shrink-0"
                                    color="warning"
                                    size="sm"
                                    variant="flat"
                                  >
                                    Condicional
                                  </Chip>
                                )}

                                {/* Enabled toggle */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <Switch
                                    classNames={{
                                      wrapper:
                                        "group-data-[selected=true]:!bg-emerald-500",
                                    }}
                                    isSelected={question.enabled}
                                    size="sm"
                                    onValueChange={() =>
                                      toggleQuestion(question.id, "enabled")
                                    }
                                  />
                                  <span
                                    className={`text-[11px] font-semibold w-12 ${
                                      question.enabled
                                        ? "text-emerald-700"
                                        : "text-gray-400"
                                    }`}
                                  >
                                    {question.enabled ? "Activa" : "Inactiva"}
                                  </span>
                                </div>

                                {/* Move to page / delete dropdown */}
                                <Dropdown>
                                  <DropdownTrigger>
                                    <button
                                      className="text-gray-400 hover:text-gray-700 flex-shrink-0 transition-colors p-1 rounded hover:bg-gray-100"
                                      type="button"
                                    >
                                      <Icon
                                        icon="solar:menu-dots-bold"
                                        width={16}
                                      />
                                    </button>
                                  </DropdownTrigger>
                                  {}
                                  <DropdownMenu
                                    aria-label="Opciones de pregunta"
                                    items={(() => {
                                      const menuItems: {
                                        key: string;
                                        label: string;
                                        icon: string;
                                        iconClass: string;
                                        action: () => void;
                                        isReadOnly?: boolean;
                                        className?: string;
                                        color?: "danger";
                                      }[] = [
                                        {
                                          key: "edit",
                                          label: "Editar título y descripción",
                                          icon: "solar:pen-2-linear",
                                          iconClass: "text-gray-500",
                                          action: () =>
                                            setEditingQuestion({
                                              id: question.id,
                                              label: question.label,
                                              fullQuestion:
                                                question.fullQuestion || "",
                                            }),
                                        },
                                      ];

                                      if (otherPages.length > 0) {
                                        for (const page of otherPages) {
                                          menuItems.push({
                                            key: `move-${page.id}`,
                                            label: `Mover a "${page.title}"`,
                                            icon: "solar:arrow-right-linear",
                                            iconClass: "text-gray-500",
                                            action: () =>
                                              moveQuestionToPage(
                                                question.id,
                                                page.id
                                              ),
                                          });
                                        }
                                      } else {
                                        menuItems.push({
                                          key: "no-pages",
                                          label: "Solo hay una página",
                                          icon: "",
                                          iconClass: "text-gray-400",
                                          isReadOnly: true,
                                          className: "text-gray-400",
                                          action: () => {},
                                        });
                                      }
                                      if (question.id.startsWith("custom_")) {
                                        menuItems.push({
                                          key: "delete",
                                          label: "Eliminar pregunta",
                                          icon: "solar:trash-bin-2-linear",
                                          iconClass: "",
                                          className: "text-danger",
                                          color: "danger",
                                          action: () =>
                                            deleteQuestion(question.id),
                                        });
                                      }

                                      return menuItems;
                                    })()}
                                  >
                                    {(item) => (
                                      <DropdownItem
                                        key={item.key}
                                        className={item.className ?? ""}
                                        color={item.color ?? "default"}
                                        isReadOnly={item.isReadOnly ?? false}
                                        startContent={
                                          item.icon ? (
                                            <Icon
                                              className={item.iconClass}
                                              icon={item.icon}
                                              width={16}
                                            />
                                          ) : undefined
                                        }
                                        onPress={item.action}
                                      >
                                        {item.label}
                                      </DropdownItem>
                                    )}
                                  </DropdownMenu>
                                </Dropdown>
                              </div>

                              {/* ── Sub-questions (groups) ─────── */}
                              {isGroup &&
                                isExpanded &&
                                question.subQuestions && (
                                  <div className="bg-gray-50 border-t border-gray-100">
                                    <div className="px-4 py-2">
                                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 ml-12">
                                        Elementos del grupo
                                      </p>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                      {question.subQuestions.map((sub) => (
                                        <div
                                          key={sub.id}
                                          className={`flex items-center gap-3 pl-16 pr-4 py-2.5 transition-colors ${
                                            sub.enabled
                                              ? "hover:bg-gray-100/50"
                                              : "opacity-50"
                                          }`}
                                        >
                                          <IconPicker
                                            size="sm"
                                            value={sub.icon}
                                            onChange={(icon) =>
                                              updateSubQuestionIcon(
                                                question.id,
                                                sub.id,
                                                icon
                                              )
                                            }
                                          />

                                          <div className="flex-1 min-w-0">
                                            <p
                                              className={`text-xs font-semibold ${sub.enabled ? "text-gray-800" : "text-gray-500"}`}
                                            >
                                              {sub.label}
                                            </p>
                                          </div>

                                          <span
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${TYPE_CHIP_STYLES[sub.type]}`}
                                          >
                                            {TYPE_LABELS[sub.type]}
                                            {sub.unit ? ` (${sub.unit})` : ""}
                                          </span>

                                          {sub.enabled && (
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                              <Switch
                                                classNames={{
                                                  wrapper:
                                                    "group-data-[selected=true]:!bg-amber-500",
                                                }}
                                                isSelected={sub.required}
                                                size="sm"
                                                onValueChange={() =>
                                                  toggleSubQuestion(
                                                    question.id,
                                                    sub.id,
                                                    "required"
                                                  )
                                                }
                                              />
                                              <span
                                                className={`text-[10px] font-semibold w-14 ${sub.required ? "text-amber-700" : "text-gray-400"}`}
                                              >
                                                {sub.required
                                                  ? "★ Oblig."
                                                  : "Opcional"}
                                              </span>
                                            </div>
                                          )}

                                          <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <Switch
                                              classNames={{
                                                wrapper:
                                                  "group-data-[selected=true]:!bg-emerald-500",
                                              }}
                                              isSelected={sub.enabled}
                                              size="sm"
                                              onValueChange={() =>
                                                toggleSubQuestion(
                                                  question.id,
                                                  sub.id,
                                                  "enabled"
                                                )
                                              }
                                            />
                                            <span
                                              className={`text-[10px] font-semibold w-10 ${sub.enabled ? "text-emerald-700" : "text-gray-400"}`}
                                            >
                                              {sub.enabled ? "On" : "Off"}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </SortableItem>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ────────────────────────────────────────────────────────────
          Add Question Modal
      ──────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isAddOpen}
        placement="center"
        size="lg"
        onClose={onAddClose}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100">
                <Icon
                  className="text-gray-700"
                  icon="solar:add-circle-bold"
                  width={24}
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Agregar Pregunta
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Se agregará a &quot;{selectedPage?.title || "General"}&quot;
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="pt-1">
                <p className="text-[11px] font-semibold text-gray-500 mb-1.5">
                  Icono
                </p>
                <IconPicker
                  value={newQ.icon}
                  onChange={(icon) => setNewQ({ ...newQ, icon })}
                />
              </div>
              <div className="flex-1 space-y-3">
                <Input
                  label="Nombre corto"
                  placeholder="Ej: Horas de Sueño"
                  value={newQ.label}
                  variant="bordered"
                  onValueChange={(v) => setNewQ({ ...newQ, label: v })}
                />
                <Input
                  label="Pregunta completa"
                  placeholder="Ej: ¿Cuántas horas has dormido?"
                  value={newQ.fullQuestion}
                  variant="bordered"
                  onValueChange={(v) => setNewQ({ ...newQ, fullQuestion: v })}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select
                className="flex-1"
                label="Tipo de respuesta"
                selectedKeys={[newQ.type]}
                variant="bordered"
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as QuestionType;

                  if (val) setNewQ({ ...newQ, type: val });
                }}
              >
                <SelectItem key="text">Texto</SelectItem>
                <SelectItem key="number">Número</SelectItem>
                <SelectItem key="rating">Valoración (1-5)</SelectItem>
                <SelectItem key="boolean">Sí / No</SelectItem>
              </Select>
              {newQ.type === "number" && (
                <Input
                  className="w-32"
                  label="Unidad"
                  placeholder="kg, cm, h..."
                  value={newQ.unit}
                  variant="bordered"
                  onValueChange={(v) => setNewQ({ ...newQ, unit: v })}
                />
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onAddClose}>
              Cancelar
            </Button>
            <Button
              className="text-white font-semibold"
              color="primary"
              isDisabled={!newQ.label.trim()}
              onPress={addQuestion}
            >
              Agregar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ────────────────────────────────────────────────────────────
          Delete Page Confirmation Modal
      ──────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!pageToDelete}
        placement="center"
        size="sm"
        onClose={() => setPageToDelete(null)}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <Icon
                  className="text-red-600"
                  icon="solar:trash-bin-2-bold"
                  width={22}
                />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Eliminar Página
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Esta acción no se puede deshacer
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-700">
              ¿Estás seguro de que quieres eliminar la página{" "}
              <strong>
                &quot;
                {config.pages.find((p) => p.id === pageToDelete)?.title}
                &quot;
              </strong>
              ? Las preguntas que contiene se moverán a la primera página
              disponible.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setPageToDelete(null)}>
              Cancelar
            </Button>
            <Button
              className="text-white font-semibold"
              color="danger"
              startContent={<Icon icon="solar:trash-bin-2-bold" width={16} />}
              onPress={confirmDeletePage}
            >
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ────────────────────────────────────────────────────────────
          Edit Question Title / Description Modal
      ──────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editingQuestion}
        placement="center"
        size="lg"
        onClose={() => setEditingQuestion(null)}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100">
                <Icon
                  className="text-gray-700"
                  icon="solar:pen-2-bold"
                  width={22}
                />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Editar Pregunta
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Personaliza el título y la descripción
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="Título corto"
              placeholder="Ej: Horas de Sueño"
              value={editingQuestion?.label || ""}
              variant="bordered"
              onValueChange={(v) =>
                setEditingQuestion((prev) =>
                  prev ? { ...prev, label: v } : null
                )
              }
            />
            <Input
              label="Pregunta completa / descripción"
              placeholder="Ej: ¿Cuántas horas has dormido en total?"
              value={editingQuestion?.fullQuestion || ""}
              variant="bordered"
              onValueChange={(v) =>
                setEditingQuestion((prev) =>
                  prev ? { ...prev, fullQuestion: v } : null
                )
              }
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setEditingQuestion(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-gray-900 text-white font-semibold"
              isDisabled={!editingQuestion?.label.trim()}
              onPress={() => {
                if (editingQuestion && editingQuestion.label.trim()) {
                  updateQuestionText(
                    editingQuestion.id,
                    editingQuestion.label.trim(),
                    editingQuestion.fullQuestion.trim()
                  );
                  setEditingQuestion(null);
                }
              }}
            >
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
