"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import ClientProfileHeader from "@/components/dashboard/client-profile/client-profile-header";
import ClientProfileTabs from "@/components/dashboard/client-profile/client-profile-tabs";
import DeleteClientModal from "@/components/dashboard/client-profile/delete-client-modal";
import UpdateStatusModal from "@/components/dashboard/client-profile/update-status-modal";
import EditClientModal from "@/components/dashboard/edit-client-modal";
import { MockClient } from "@/lib/mock-data/client-profile-mock";

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const [client, setClient] = useState<MockClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/clients/${clientId}/profile`);

      if (!response.ok) {
        throw new Error("Failed to fetch client data");
      }

      const data = await response.json();

      setClient(data);
    } catch (err) {
      console.error("Error fetching client data:", err);
      setError("No se pudo cargar el perfil del cliente");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, [clientId]);

  const handleBack = () => {
    router.push("/trainer/dashboard?tab=clients");
  };

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    // Refresh client data after successful edit
    fetchClientData();
  };

  const handleUpdateStatus = () => {
    setIsStatusModalOpen(true);
  };

  const handleStatusUpdateSuccess = () => {
    // Refresh client data after successful status update
    fetchClientData();
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSuccess = () => {
    // Navigate back to clients list after successful deletion
    router.push("/trainer/dashboard?tab=clients");
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-default-500 font-body">
              Cargando perfil del cliente...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-danger text-lg mb-4">
              {error || "Cliente no encontrado"}
            </p>
            <button
              className="text-black hover:underline"
              onClick={handleBack}
            >
              Volver a Clientes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <ClientProfileHeader
        client={client}
        onBack={handleBack}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onUpdateStatus={handleUpdateStatus}
      />
      <ClientProfileTabs clientId={clientId} />

      {/* Edit Client Modal */}
      {client && (
        <EditClientModal
          clientData={{
            firstName: client.firstName,
            lastName: client.lastName,
            nickName: client.nickName || "",
            email: client.email,
            phone: client.phone || "",
            occupation: client.occupation || "",
            dob: client.dob || "",
            city: client.location?.city || "",
            state: client.location?.state || "",
            country: client.location?.country || "",
            zip: client.location?.zip || "",
            nationalId: client.nationalId || "",
            status: client.status || "",
          }}
          clientId={clientId}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Update Status Modal */}
      {client && (
        <UpdateStatusModal
          clientId={clientId}
          clientName={client.name}
          currentStatus={client.status}
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          onSuccess={handleStatusUpdateSuccess}
        />
      )}

      {/* Delete Client Modal */}
      {client && (
        <DeleteClientModal
          clientId={clientId}
          clientName={client.name}
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}
