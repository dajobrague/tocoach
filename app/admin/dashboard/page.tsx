"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to trainers page by default
    router.replace("/admin/dashboard/trainers");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-slate-500">Redirigiendo...</p>
    </div>
  );
}
