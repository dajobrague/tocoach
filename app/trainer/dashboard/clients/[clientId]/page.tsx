/* eslint-disable no-console */
"use client";

import { Button, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import ClientProfileHeader, {
  ClientProfileHeaderSkeleton,
} from "@/components/dashboard/client-profile/client-profile-header";
import ClientProfileTabs from "@/components/dashboard/client-profile/client-profile-tabs";
import DeleteClientModal from "@/components/dashboard/client-profile/delete-client-modal";
import UpdateStatusModal from "@/components/dashboard/client-profile/update-status-modal";
import { useModalParam } from "@/components/dashboard/client-profile/use-url-state";
import EditClientModal from "@/components/dashboard/edit-client-modal";
import { CenteredState } from "@/components/shared/centered-state";
import { MockClient } from "@/lib/mock-data/client-profile-mock";

/* El perfil entra por un skeleton con la forma exacta del header, no por un
   spinner centrado: el swap spinner → contenido movía toda la página en cada
   apertura de cliente (layout shift). */
function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ClientProfileHeaderSkeleton />
      <div className="border-b border-divider bg-content1">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-6 px-4 sm:px-6 lg:px-8">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-3 w-24 rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ClientProfileInner() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const { modal, openModal, closeModal } = useModalParam();
  const [client, setClient] = useState<MockClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    router.push("/trainer/dashboard/clients");
  };

  const handleEditSuccess = () => {
    fetchClientData();
  };

  const handleStatusUpdateSuccess = () => {
    fetchClientData();
  };

  const handleDeleteSuccess = () => {
    router.push("/trainer/dashboard/clients");
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error || !client) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="mx-auto w-full max-w-lg px-4 py-16">
          <CenteredState
            action={
              <Button
                className="mt-2"
                startContent={
                  <Icon icon="solar:arrow-left-linear" width={18} />
                }
                variant="flat"
                onPress={handleBack}
              >
                Volver a Clientes
              </Button>
            }
            icon="solar:user-cross-linear"
            subtitle="Puede que el cliente se haya eliminado o que el enlace ya no sea válido."
            title={error || "Cliente no encontrado"}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ClientProfileHeader
        client={client}
        onBack={handleBack}
        onDelete={() => openModal("delete")}
        onEdit={() => openModal("edit")}
        onUpdateStatus={() => openModal("status")}
      />
      <ClientProfileTabs clientId={clientId} clientName={client.name} />

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
            sex: client.sex ?? "",
            heightCm:
              typeof client.heightCm === "number"
                ? String(client.heightCm)
                : "",
            city: client.location?.city || "",
            state: client.location?.state || "",
            country: client.location?.country || "",
            zip: client.location?.zip || "",
            nationalId: client.nationalId || "",
            status: client.status || "",
          }}
          clientId={clientId}
          isOpen={modal === "edit"}
          onClose={closeModal}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Update Status Modal */}
      {client && (
        <UpdateStatusModal
          clientId={clientId}
          clientName={client.name}
          currentStatus={client.status}
          isOpen={modal === "status"}
          onClose={closeModal}
          onSuccess={handleStatusUpdateSuccess}
        />
      )}

      {/* Delete Client Modal */}
      {client && (
        <DeleteClientModal
          clientId={clientId}
          clientName={client.name}
          isOpen={modal === "delete"}
          onClose={closeModal}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}

export default function ClientProfilePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ClientProfileInner />
    </Suspense>
  );
}
