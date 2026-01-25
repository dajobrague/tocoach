"use client";

import { Icon } from "@iconify/react";
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
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import React from "react";

import AddAdminModal from "@/components/admin/add-admin-modal";
import EditProfileModal from "@/components/admin/edit-profile-modal";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: "super_admin" | "admin";
  status: "active" | "inactive";
  created_at: string;
  last_login_at: string | null;
}

interface ConfirmAction {
  type: "role" | "status" | "delete";
  userId: string;
  newValue: string;
  userName: string;
  description: string;
}

export default function AdminUsersPage() {
  const [adminUsers, setAdminUsers] = React.useState<AdminUser[]>([]);
  const [currentAdminId, setCurrentAdminId] = React.useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [updatingUserId, setUpdatingUserId] = React.useState<string | null>(
    null
  );
  const [confirmAction, setConfirmAction] =
    React.useState<ConfirmAction | null>(null);
  const [editProfileUser, setEditProfileUser] =
    React.useState<AdminUser | null>(null);

  const fetchAdminUsers = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/users", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Error fetching admin users");
      }

      const data = await response.json();

      setAdminUsers(data.adminUsers || []);

      // Set current admin ID if not already set
      if (!currentAdminId && data.currentAdminId) {
        setCurrentAdminId(data.currentAdminId);
      }
    } catch (error) {
      console.error("Error fetching admin users:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentAdminId]);

  React.useEffect(() => {
    fetchAdminUsers();
  }, [fetchAdminUsers]);

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    setUpdatingUserId(userId);
    setConfirmAction(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Error updating status");
      }

      await fetchAdminUsers();
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    setConfirmAction(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error("Error updating role");
      }

      await fetchAdminUsers();
    } catch (error) {
      console.error("Error updating role:", error);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setUpdatingUserId(userId);
    setConfirmAction(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Error deleting user");
      }

      await fetchAdminUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const confirmAndExecute = () => {
    if (!confirmAction) return;

    if (confirmAction.type === "role") {
      handleUpdateRole(confirmAction.userId, confirmAction.newValue);
    } else if (confirmAction.type === "status") {
      handleUpdateStatus(confirmAction.userId, confirmAction.newValue);
    } else if (confirmAction.type === "delete") {
      handleDeleteUser(confirmAction.userId);
    }
  };

  const requestRoleChange = (user: AdminUser, newRole: string) => {
    const roleLabel = newRole === "super_admin" ? "Super Admin" : "Admin";

    setConfirmAction({
      type: "role",
      userId: user.id,
      newValue: newRole,
      userName: user.full_name,
      description: `¿Estás seguro que deseas cambiar el rol de ${user.full_name} a ${roleLabel}?`,
    });
  };

  const requestStatusChange = (user: AdminUser, newStatus: string) => {
    const statusLabel = newStatus === "active" ? "activar" : "desactivar";
    const warning =
      newStatus === "inactive"
        ? " Este usuario perderá acceso al panel administrativo."
        : "";

    setConfirmAction({
      type: "status",
      userId: user.id,
      newValue: newStatus,
      userName: user.full_name,
      description: `¿Estás seguro que deseas ${statusLabel} a ${user.full_name}?${warning}`,
    });
  };

  const requestDelete = (user: AdminUser) => {
    setConfirmAction({
      type: "delete",
      userId: user.id,
      newValue: "",
      userName: user.full_name,
      description: `¿Estás seguro que deseas ELIMINAR PERMANENTEMENTE a ${user.full_name}? Esta acción NO se puede deshacer y eliminará completamente al usuario del sistema, incluyendo su cuenta de autenticación.`,
    });
  };

  const filteredUsers = adminUsers.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = adminUsers.filter((u) => u.status === "active").length;
  const superAdminCount = adminUsers.filter(
    (u) => u.role === "super_admin"
  ).length;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";

    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading text-slate-900">
            Usuarios Administradores
          </h1>
          <p className="text-slate-500 font-body mt-1">
            Gestiona los usuarios con acceso al panel administrativo
          </p>
        </div>
        <Button
          className="bg-black text-white font-body"
          color="primary"
          size="lg"
          startContent={<Icon icon="solar:user-plus-bold" />}
          onPress={() => setIsAddModalOpen(true)}
        >
          Agregar Admin
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-body">Total</p>
                <p className="text-2xl font-bold font-heading text-slate-900">
                  {adminUsers.length}
                </p>
              </div>
              <div className="bg-black p-3 rounded-xl">
                <Icon
                  className="text-2xl text-white"
                  icon="solar:shield-user-bold"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-body">Activos</p>
                <p className="text-2xl font-bold font-heading text-green-600">
                  {activeCount}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <Icon
                  className="text-2xl text-green-600"
                  icon="solar:check-circle-bold"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-body">Super Admins</p>
                <p className="text-2xl font-bold font-heading text-indigo-600">
                  {superAdminCount}
                </p>
              </div>
              <div className="bg-indigo-100 p-3 rounded-xl">
                <Icon
                  className="text-2xl text-indigo-600"
                  icon="solar:star-bold"
                />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardBody>
          <Input
            className="w-full"
            placeholder="Buscar por nombre o email..."
            startContent={<Icon icon="solar:magnifer-linear" />}
            value={searchTerm}
            variant="bordered"
            onValueChange={setSearchTerm}
          />
        </CardBody>
      </Card>

      {/* Admin Users Table */}
      <Card>
        <CardBody>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <Table aria-label="Admin users table">
              <TableHeader>
                <TableColumn>USUARIO</TableColumn>
                <TableColumn>ROL</TableColumn>
                <TableColumn>ESTADO</TableColumn>
                <TableColumn>ÚLTIMO ACCESO</TableColumn>
                <TableColumn>ACCIONES</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No hay usuarios administradores">
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold font-body">
                          {user.full_name}
                        </p>
                        <p className="text-sm text-slate-500 font-body">
                          {user.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={
                          user.role === "super_admin" ? "secondary" : "primary"
                        }
                        size="sm"
                        variant="flat"
                      >
                        {user.role === "super_admin" ? "Super Admin" : "Admin"}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={user.status === "active" ? "success" : "default"}
                        size="sm"
                        variant="flat"
                      >
                        {user.status === "active" ? "Activo" : "Inactivo"}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-500 font-body">
                        {formatDate(user.last_login_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Dropdown>
                        <DropdownTrigger>
                          <Button
                            isIconOnly
                            isLoading={updatingUserId === user.id}
                            size="sm"
                            variant="light"
                          >
                            <Icon icon="solar:menu-dots-bold" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Actions">
                          {/* Show edit profile for own profile */}
                          {user.id === currentAdminId ? (
                            <DropdownItem
                              key="edit-profile"
                              startContent={<Icon icon="solar:pen-bold" />}
                              onPress={() => setEditProfileUser(user)}
                            >
                              Editar Mi Perfil
                            </DropdownItem>
                          ) : null}
                          {/* Only show role/status options if NOT viewing own profile */}
                          {user.id !== currentAdminId ? (
                            <>
                              {user.role !== "super_admin" ? (
                                <DropdownItem
                                  key="make-super-admin"
                                  startContent={<Icon icon="solar:star-bold" />}
                                  onPress={() =>
                                    requestRoleChange(user, "super_admin")
                                  }
                                >
                                  Hacer Super Admin
                                </DropdownItem>
                              ) : null}
                              {user.role !== "admin" ? (
                                <DropdownItem
                                  key="make-admin"
                                  startContent={<Icon icon="solar:user-bold" />}
                                  onPress={() =>
                                    requestRoleChange(user, "admin")
                                  }
                                >
                                  Hacer Admin
                                </DropdownItem>
                              ) : null}
                              {user.status !== "active" ? (
                                <DropdownItem
                                  key="activate"
                                  startContent={
                                    <Icon icon="solar:check-circle-bold" />
                                  }
                                  onPress={() =>
                                    requestStatusChange(user, "active")
                                  }
                                >
                                  Activar
                                </DropdownItem>
                              ) : null}
                              {user.status !== "inactive" ? (
                                <DropdownItem
                                  key="deactivate"
                                  className="text-warning"
                                  color="warning"
                                  startContent={
                                    <Icon icon="solar:close-circle-bold" />
                                  }
                                  onPress={() =>
                                    requestStatusChange(user, "inactive")
                                  }
                                >
                                  Desactivar
                                </DropdownItem>
                              ) : null}
                              <DropdownItem
                                key="delete"
                                className="text-danger"
                                color="danger"
                                startContent={
                                  <Icon icon="solar:trash-bin-trash-bold" />
                                }
                                onPress={() => requestDelete(user)}
                              >
                                Eliminar Permanentemente
                              </DropdownItem>
                            </>
                          ) : null}
                        </DropdownMenu>
                      </Dropdown>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Add Admin Modal */}
      <AddAdminModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchAdminUsers();
        }}
      />

      {/* Edit Profile Modal */}
      {editProfileUser && (
        <EditProfileModal
          currentEmail={editProfileUser.email}
          currentName={editProfileUser.full_name}
          isOpen={!!editProfileUser}
          userId={editProfileUser.id}
          onClose={() => setEditProfileUser(null)}
          onSuccess={() => {
            setEditProfileUser(null);
            fetchAdminUsers();
          }}
        />
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!confirmAction}
        size="md"
        onClose={() => setConfirmAction(null)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Icon
                className="text-2xl text-warning"
                icon="solar:danger-circle-bold-duotone"
              />
              <h2 className="text-xl font-heading font-bold">
                Confirmar Acción
              </h2>
            </div>
          </ModalHeader>
          <ModalBody>
            <p className="text-slate-700 font-body">
              {confirmAction?.description}
            </p>
            <div
              className={`${confirmAction?.type === "delete" ? "bg-danger-50 border-danger-200" : "bg-warning-50 border-warning-200"} border rounded-lg p-3 mt-2`}
            >
              <div className="flex items-start gap-2">
                <Icon
                  className={`${confirmAction?.type === "delete" ? "text-danger" : "text-warning"} text-lg mt-0.5`}
                  icon={
                    confirmAction?.type === "delete"
                      ? "solar:danger-triangle-bold"
                      : "solar:info-circle-bold"
                  }
                />
                <p
                  className={`text-sm ${confirmAction?.type === "delete" ? "text-danger-800" : "text-warning-800"} font-body`}
                >
                  {confirmAction?.type === "delete"
                    ? "¡ADVERTENCIA! Esta acción es IRREVERSIBLE y eliminará todos los datos del usuario permanentemente."
                    : "Esta acción no se puede deshacer fácilmente. Asegúrate de que sea correcta."}
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="light"
              onPress={() => setConfirmAction(null)}
            >
              Cancelar
            </Button>
            <Button
              className="font-semibold"
              color={confirmAction?.type === "delete" ? "danger" : "warning"}
              onPress={confirmAndExecute}
            >
              {confirmAction?.type === "delete"
                ? "Sí, Eliminar Permanentemente"
                : "Confirmar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
