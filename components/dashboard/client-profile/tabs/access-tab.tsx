"use client";

import { Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";

const PRODUCTION_DOMAIN =
  process.env.NEXT_PUBLIC_APP_DOMAIN || "app.topcoach.io";

interface AccessTabProps {
  clientId: string;
  clientName: string;
}

interface AccessData {
  email: string;
  tenantSlug: string;
}

export default function AccessTab({ clientId, clientName }: AccessTabProps) {
  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/clients/${clientId}/profile`);

        if (!res.ok) throw new Error("No se pudo cargar la información");
        const json = await res.json();

        if (cancelled) return;
        setData({ email: json.email ?? "", tenantSlug: json.tenantSlug ?? "" });
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Error al cargar datos"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Spinner color="primary" size="lg" />
        <p className="text-sm text-gray-500">Cargando datos de acceso...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <Icon icon="solar:danger-triangle-bold" width={48} />
        <p className="text-sm text-red-500 font-medium">
          {error || "No se encontraron datos"}
        </p>
      </div>
    );
  }

  const { email: clientEmail, tenantSlug } = data;
  const loginUrl = `https://${PRODUCTION_DOMAIN}/${tenantSlug}/login`;

  return (
    <div className="py-6 space-y-8">
      {/* Title */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
          <Icon className="text-blue-600" icon="solar:key-bold" width={24} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Instrucciones de Acceso para {clientName}
          </h1>
          <p className="text-sm text-gray-500">
            Comparte esta información con tu cliente para que pueda acceder a su
            plataforma de entrenamiento.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Steps */}
        <div className="xl:col-span-3 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Pasos para que tu cliente acceda
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {/* Step 1 */}
            <div className="px-6 py-5 flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    El cliente debe abrir el siguiente enlace en su navegador
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Esta es la dirección personalizada de tu plataforma. El
                    cliente puede acceder desde cualquier dispositivo (celular,
                    computadora o tablet).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-sm text-blue-700 break-all">
                    {loginUrl}
                  </div>
                  <Button
                    className="flex-shrink-0"
                    color={copiedField === "url" ? "success" : "primary"}
                    size="sm"
                    variant="flat"
                    onPress={() => copyToClipboard(loginUrl, "url")}
                  >
                    <Icon
                      icon={
                        copiedField === "url"
                          ? "solar:check-circle-bold"
                          : "solar:copy-bold"
                      }
                      width={16}
                    />
                    {copiedField === "url" ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="px-6 py-5 flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    El cliente debe ingresar su correo electrónico
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Debe usar <strong>exactamente el mismo correo</strong> que
                    registraste en el sistema al crear su perfil.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-sm text-gray-800">
                    {clientEmail || "—"}
                  </div>
                  {clientEmail && (
                    <Button
                      className="flex-shrink-0"
                      color={copiedField === "email" ? "success" : "primary"}
                      size="sm"
                      variant="flat"
                      onPress={() => copyToClipboard(clientEmail, "email")}
                    >
                      <Icon
                        icon={
                          copiedField === "email"
                            ? "solar:check-circle-bold"
                            : "solar:copy-bold"
                        }
                        width={16}
                      />
                      {copiedField === "email" ? "Copiado" : "Copiar"}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="px-6 py-5 flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">
                  Primera vez — Crear contraseña
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Si es la <strong>primera vez</strong> que el cliente accede,
                  el sistema le pedirá que cree una contraseña. Solo necesita
                  hacerlo una vez. Después de eso, podrá acceder directamente
                  con su correo y contraseña.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="px-6 py-5 flex gap-4">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                <Icon icon="solar:check-circle-bold" width={18} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">
                  ¡Listo! Ya puede ver sus entrenamientos
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Una vez dentro, el cliente verá todos los programas,
                  ejercicios, nutrición y cualquier contenido que le hayas
                  asignado. También podrá registrar su progreso.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="xl:col-span-2 space-y-6">
          {/* Quick-copy message */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                Mensaje listo para enviar
              </h2>
              <Button
                color={copiedField === "message" ? "success" : "primary"}
                size="sm"
                variant="flat"
                onPress={() =>
                  copyToClipboard(
                    buildMessage(clientName, clientEmail, loginUrl),
                    "message"
                  )
                }
              >
                <Icon
                  icon={
                    copiedField === "message"
                      ? "solar:check-circle-bold"
                      : "solar:copy-bold"
                  }
                  width={16}
                />
                {copiedField === "message" ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-500 mb-3">
                Copia y pega este mensaje para enviárselo a tu cliente por
                WhatsApp, email o cualquier medio:
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                {buildMessage(clientName, clientEmail, loginUrl)}
              </div>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <Icon
                className="text-amber-600 flex-shrink-0 mt-0.5"
                icon="solar:info-circle-bold"
                width={20}
              />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-amber-900">
                  ¿Problemas de acceso?
                </h3>
                <ul className="text-sm text-amber-800 space-y-1.5">
                  <li>
                    • <strong>El correo no es reconocido:</strong> Verifica que
                    el correo registrado en el perfil del cliente sea el
                    correcto.
                  </li>
                  <li>
                    • <strong>Olvidó su contraseña:</strong> En la pantalla de
                    login hay una opción &quot;¿Olvidaste tu contraseña?&quot;
                    para restablecerla.
                  </li>
                  <li>
                    • <strong>No puede ver contenido:</strong> Asegúrate de
                    haber asignado programas o contenido al cliente desde las
                    otras pestañas.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildMessage(name: string, email: string, url: string): string {
  const firstName = name.split(" ")[0] ?? name;

  return `¡Hola ${firstName}! 👋

Ya tienes acceso a tu plataforma de entrenamiento. Sigue estos pasos:

1️⃣ Abre este enlace:
${url}

2️⃣ Ingresa tu correo electrónico:
${email}

3️⃣ Si es tu primera vez, el sistema te pedirá crear una contraseña. Solo tienes que hacerlo una vez.

¡Después de eso ya podrás ver tus entrenamientos, nutrición y registrar tu progreso! 💪`;
}
