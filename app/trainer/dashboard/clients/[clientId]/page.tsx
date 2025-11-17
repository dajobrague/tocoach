"use client";

import ClientProfileHeader from "@/components/dashboard/client-profile/client-profile-header";
import ClientProfileTabs from "@/components/dashboard/client-profile/client-profile-tabs";
import { getMockClientById } from "@/lib/mock-data/client-profile-mock";
import { useParams, useRouter } from "next/navigation";

export default function ClientProfilePage() {
    const params = useParams();
    const router = useRouter();
    const clientId = params.clientId as string;

    // Get mock client data
    const client = getMockClientById(clientId);

    const handleBack = () => {
        router.push("/trainer/dashboard?tab=clients");
    };

    const handleEdit = () => {
        // TODO: Implement edit functionality
        console.log("Edit client:", clientId);
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <ClientProfileHeader
                client={client}
                onBack={handleBack}
                onEdit={handleEdit}
            />
            <ClientProfileTabs clientId={clientId} />
        </div>
    );
}

