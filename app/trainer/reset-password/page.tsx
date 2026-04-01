"use client";

import { useRouter } from "next/navigation";
import React from "react";

export default function TrainerResetPasswordPage() {
  const router = useRouter();

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      router.replace("/trainer/forgot-password");
    }, 2000);

    return () => clearTimeout(id);
  }, [router]);

  return (
    <div className="flex h-full w-full items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md">
        <div className="rounded-large bg-content1 shadow-small p-8 text-center">
          <p className="font-body text-default-600">
            El método de recuperación ha cambiado. Redirigiendo…
          </p>
        </div>
      </div>
    </div>
  );
}
