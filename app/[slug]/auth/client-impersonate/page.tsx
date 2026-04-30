"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { Spinner } from "@heroui/react";

import { storeClientToken } from "@/lib/auth/client-token-storage";

function ClientImpersonateContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const slug = params.slug as string;
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("Verificando acceso...");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Token no proporcionado");

      return;
    }

    async function impersonate() {
      try {
        const response = await fetch("/api/auth/client-impersonate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          setStatus("error");
          setMessage(data.error || "Error al acceder a la cuenta");

          return;
        }

        // Persist the JWT for the Bearer fallback transport. The cookie was
        // set by the server, but iframe / Safari ITP / in-app-browser
        // environments often drop SameSite=None cookies — without
        // localStorage we'd see "No autorizado" on the first SPA fetch.
        if (data.token) {
          storeClientToken(data.token);
        }

        setStatus("success");
        setMessage(
          `Accediendo como ${data.client?.fullName || data.client?.email}... Redirigiendo al panel del cliente...`
        );

        setTimeout(() => {
          window.location.href = `/${slug}/dashboard`;
        }, 1500);
      } catch (error) {
        console.error("Error impersonating client:", error);
        setStatus("error");
        setMessage("Error al acceder a la cuenta");
      }
    }

    impersonate();
  }, [searchParams, slug]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <Spinner color="primary" size="lg" />
            <p className="mt-4 text-slate-600 font-body">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M5 13l4 4L19 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </div>
            <p className="text-green-600 font-semibold font-heading text-lg">
              {message}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Sesión de soporte • Todas las acciones son registradas
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </div>
            <p className="text-red-600 font-semibold font-heading text-lg mb-4">
              {message}
            </p>
            <a
              className="text-purple-600 hover:underline font-body"
              href="/admin/dashboard/trainers"
            >
              Volver al panel de administración
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function ClientImpersonatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <ClientImpersonateContent />
    </Suspense>
  );
}
