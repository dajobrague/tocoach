"use client";

import { Icon } from "@iconify/react";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Modal,
  ModalContent,
  addToast,
} from "@heroui/react";
import React from "react";

import AddAdminModal from "@/components/admin/add-admin-modal";
import {
  Avatar,
  DialogHeader,
  PageHeader,
  RelativeTime,
  SearchField,
  SkeletonRows,
  SortHeader,
  StatusDot,
  buttonClasses,
  dialogClassNames,
  formatDate,
  tableClasses,
  useSort,
} from "@/components/admin/admin-ui";
import EditProfileModal from "@/components/admin/edit-profile-modal";
import { useAdminData } from "@/lib/admin/use-admin-data";

type Role = "super_admin" | "admin";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: "active" | "inactive";
  created_at: string;
  last_login_at: string | null;
}

interface PendingAction {
  user: AdminUser;
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  run: () => Promise<Response>;
  success: string;
}

type SortKey = "name" | "role" | "status" | "login" | "created";

const SORT_ACCESSORS: Record<
  SortKey,
  (u: AdminUser) => string | number | null
> = {
  name: (u) => u.full_name,
  role: (u) => u.role,
  status: (u) => u.status,
  login: (u) => u.last_login_at,
  created: (u) => u.created_at,
};

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super admin",
  admin: "Admin",
};

function patchUser(id: string, body: Record<string, string>) {
  return fetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
}

export default function AdminUsersPage() {
  const {
    data,
    error: loadError,
    isLoading,
    refresh: fetchAdmins,
  } = useAdminData<{ adminUsers: AdminUser[]; currentAdminId: string | null }>(
    "/api/admin/users"
  );
  const admins = React.useMemo(() => data?.adminUsers ?? [], [data]);
  const currentAdminId = data?.currentAdminId ?? null;
  const [search, setSearch] = React.useState("");
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [editingSelf, setEditingSelf] = React.useState<AdminUser | null>(null);
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);

  const me = admins.find((a) => a.id === currentAdminId);
  const canManage = me?.role === "super_admin";

  const runPending = async () => {
    if (!pending) return;
    setIsRunning(true);

    try {
      const response = await pending.run();

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new Error(data.error || "Error");
      }
      addToast({ title: pending.success, color: "success" });
      setPending(null);
      await fetchAdmins();
    } catch (error) {
      addToast({
        title:
          error instanceof Error && error.message !== "Error"
            ? error.message
            : "No se pudo completar la acción",
        color: "danger",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const askRole = (user: AdminUser, role: Role) =>
    setPending({
      user,
      title: `Cambiar rol a ${ROLE_LABEL[role]}`,
      description:
        role === "super_admin"
          ? `${user.full_name} podrá crear, editar y eliminar administradores.`
          : `${user.full_name} solo podrá gestionar entrenadores.`,
      confirmLabel: "Cambiar rol",
      destructive: false,
      run: () => patchUser(user.id, { role }),
      success: "Rol actualizado",
    });

  const askStatus = (user: AdminUser, status: AdminUser["status"]) =>
    setPending({
      user,
      title: status === "active" ? "Reactivar acceso" : "Desactivar acceso",
      description:
        status === "active"
          ? `${user.full_name} podrá volver a entrar al panel.`
          : `${user.full_name} no podrá entrar al panel hasta que lo reactives. Puedes deshacerlo cuando quieras.`,
      confirmLabel: status === "active" ? "Reactivar" : "Desactivar",
      destructive: false,
      run: () => patchUser(user.id, { status }),
      success: status === "active" ? "Acceso reactivado" : "Acceso desactivado",
    });

  const askDelete = (user: AdminUser) =>
    setPending({
      user,
      title: `Eliminar a ${user.full_name}`,
      description:
        "Se borra su cuenta de administrador y su usuario de acceso. No se puede deshacer. Si solo quieres quitarle el acceso, desactívalo.",
      confirmLabel: "Eliminar",
      destructive: true,
      run: () =>
        fetch(`/api/admin/users/${user.id}`, {
          method: "DELETE",
          credentials: "include",
        }),
      success: "Administrador eliminado",
    });

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase();

    return admins.filter(
      (u) =>
        !term ||
        u.full_name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
    );
  }, [admins, search]);

  const { sorted, sort, toggle } = useSort(visible, SORT_ACCESSORS, {
    key: "name",
    dir: "asc",
  });

  const takenEmails = React.useMemo(
    () => new Set(admins.map((a) => a.email.toLowerCase())),
    [admins]
  );

  const loading = isLoading && admins.length === 0;
  const superCount = admins.filter((a) => a.role === "super_admin").length;
  const inactiveCount = admins.filter((a) => a.status !== "active").length;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-10 py-8">
      <PageHeader
        actions={
          <button
            className={buttonClasses.primary}
            disabled={!canManage}
            title={
              canManage
                ? undefined
                : "Solo un super admin puede añadir administradores"
            }
            type="button"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Icon icon="solar:add-circle-linear" width={16} />
            Nuevo administrador
          </button>
        }
        subtitle={
          loading
            ? "Cargando…"
            : [
                `${admins.length} administradores`,
                `${superCount} super admin`,
                inactiveCount > 0 ? `${inactiveCount} sin acceso` : null,
              ]
                .filter(Boolean)
                .join(" · ")
        }
        title="Administradores"
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] text-slate-500">
          {canManage
            ? "Los admin gestionan entrenadores; los super admin además gestionan este equipo."
            : "Solo un super admin puede cambiar roles o accesos."}
        </p>
        <SearchField
          placeholder="Buscar nombre o email"
          value={search}
          onChange={setSearch}
        />
      </div>

      {loadError ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          No se pudieron cargar los administradores.
          <button
            className="font-medium underline-offset-2 hover:underline"
            type="button"
            onClick={fetchAdmins}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      <div className={tableClasses.wrapper}>
        <table className={tableClasses.table}>
          <thead className={tableClasses.thead}>
            <tr>
              <SortHeader
                className="pl-4"
                label="Administrador"
                sort={sort}
                sortKey="name"
                onSort={toggle}
              />
              <SortHeader
                label="Rol"
                sort={sort}
                sortKey="role"
                onSort={toggle}
              />
              <SortHeader
                label="Acceso"
                sort={sort}
                sortKey="status"
                onSort={toggle}
              />
              <SortHeader
                label="Último acceso"
                sort={sort}
                sortKey="login"
                onSort={toggle}
              />
              <SortHeader
                label="Alta"
                sort={sort}
                sortKey="created"
                onSort={toggle}
              />
              <th className="w-32 px-3 py-2" scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody
            key={loading ? "loading" : "ready"}
            className={loading ? undefined : "admin-fade-in"}
          >
            {loading ? (
              <SkeletonRows cols={6} rows={4} />
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-16 text-center text-slate-500"
                  colSpan={6}
                >
                  {search
                    ? `Nada coincide con “${search}”.`
                    : "No hay administradores."}
                </td>
              </tr>
            ) : (
              sorted.map((u) => {
                const isMe = u.id === currentAdminId;

                return (
                  <tr
                    key={u.id}
                    className={tableClasses.row.replace("cursor-pointer ", "")}
                  >
                    <td className={`${tableClasses.cell} pl-4`}>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.full_name} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-slate-900">
                              {u.full_name}
                            </span>
                            {isMe ? (
                              <span className="inline-flex h-[18px] items-center rounded bg-slate-100 px-1.5 text-[11px] font-medium text-slate-500">
                                Tú
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-[12px] text-slate-500">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={`${tableClasses.cell} text-slate-700`}>
                      {ROLE_LABEL[u.role]}
                    </td>
                    <td className={tableClasses.cell}>
                      <StatusDot
                        label={u.status === "active" ? "Activo" : "Desactivado"}
                        tone={u.status === "active" ? "green" : "gray"}
                      />
                    </td>
                    <td className={tableClasses.cell}>
                      <RelativeTime iso={u.last_login_at} />
                    </td>
                    <td className={`${tableClasses.cell} text-slate-500`}>
                      {formatDate(u.created_at)}
                    </td>
                    <td className={`${tableClasses.cell} pr-3`}>
                      <div className="flex items-center justify-end gap-1">
                        {isMe ? (
                          <button
                            className="h-7 rounded-md px-2 text-[12px] font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                            type="button"
                            onClick={() => setEditingSelf(u)}
                          >
                            Editar perfil
                          </button>
                        ) : canManage ? (
                          <Dropdown placement="bottom-end">
                            <DropdownTrigger>
                              <button
                                aria-label={`Más acciones para ${u.full_name}`}
                                className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-900"
                                type="button"
                              >
                                <Icon icon="solar:menu-dots-bold" width={16} />
                              </button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Acciones">
                              <DropdownSection showDivider>
                                <DropdownItem
                                  key="role"
                                  onPress={() =>
                                    askRole(
                                      u,
                                      u.role === "super_admin"
                                        ? "admin"
                                        : "super_admin"
                                    )
                                  }
                                >
                                  {u.role === "super_admin"
                                    ? "Cambiar a admin"
                                    : "Hacer super admin"}
                                </DropdownItem>
                                <DropdownItem
                                  key="status"
                                  onPress={() =>
                                    askStatus(
                                      u,
                                      u.status === "active"
                                        ? "inactive"
                                        : "active"
                                    )
                                  }
                                >
                                  {u.status === "active"
                                    ? "Desactivar acceso"
                                    : "Reactivar acceso"}
                                </DropdownItem>
                              </DropdownSection>
                              <DropdownSection>
                                <DropdownItem
                                  key="delete"
                                  className="text-danger"
                                  color="danger"
                                  onPress={() => askDelete(u)}
                                >
                                  Eliminar permanentemente
                                </DropdownItem>
                              </DropdownSection>
                            </DropdownMenu>
                          </Dropdown>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AddAdminModal
        isOpen={isAddModalOpen}
        takenEmails={takenEmails}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={fetchAdmins}
      />

      {editingSelf && (
        <EditProfileModal
          currentEmail={editingSelf.email}
          currentName={editingSelf.full_name}
          isOpen={!!editingSelf}
          userId={editingSelf.id}
          onClose={() => setEditingSelf(null)}
          onSuccess={() => {
            setEditingSelf(null);
            fetchAdmins();
          }}
        />
      )}

      <Modal
        hideCloseButton
        classNames={dialogClassNames}
        isDismissable={!isRunning}
        isOpen={!!pending}
        size="md"
        onClose={() => !isRunning && setPending(null)}
      >
        <ModalContent>
          {pending ? (
            <div className="p-6">
              <DialogHeader title={pending.title} />
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                {pending.description}
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  className={buttonClasses.ghost}
                  disabled={isRunning}
                  type="button"
                  onClick={() => setPending(null)}
                >
                  Cancelar
                </button>
                <button
                  className={
                    pending.destructive
                      ? buttonClasses.danger
                      : buttonClasses.primary
                  }
                  disabled={isRunning}
                  type="button"
                  onClick={runPending}
                >
                  {isRunning ? "…" : pending.confirmLabel}
                </button>
              </div>
            </div>
          ) : null}
        </ModalContent>
      </Modal>
    </div>
  );
}
