"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import ClientProfileHeader from "@/components/dashboard/client-profile/client-profile-header";
import ClientProfileTabs from "@/components/dashboard/client-profile/client-profile-tabs";
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
              className="text-primary hover:underline"
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
        onEdit={handleEdit}
      />
      <ClientProfileTabs clientId={clientId} />

      {/* Edit Client Modal */}
      {client && (
        <EditClientModal
          clientData={{
            firstName: client.firstName,
            lastName: client.lastName,
            nickName: client.nickName,
            email: client.email,
            phone: client.phone,
            occupation: client.occupation,
            dob: client.dob,
            city: client.location?.city,
            state: client.location?.state,
            country: client.location?.country,
            zip: client.location?.zip,
            nationalId: client.nationalId,
            status: client.status,
          }}
          clientId={clientId}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
