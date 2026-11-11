// Recordatorios de formularios (check-in abierto, check-in a punto de cerrar,
// registro diario): el propio servidor web llama cada hora en punto a
// PUT /api/forms/notifications/create. Antes dependía de un servicio cron
// aparte que nunca llegó a desplegarse, así que en producción no se creó ni
// un solo recordatorio.
//
// ponytail: temporizador en proceso. Si el servidor se reinicia justo a la
// hora en punto, esa pasada se pierde; con varias réplicas se repetiría (los
// avisos ya se deduplican por cliente). Pasar a un cron externo si importa.

const HOUR_MS = 60 * 60 * 1000;

export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NODE_ENV !== "production"
  ) {
    return;
  }

  // Clave de un solo proceso: la ruta solo acepta esta clave o CRON_SECRET.
  const key = crypto.randomUUID();

  (globalThis as { __formRemindersKey?: string }).__formRemindersKey = key;

  const run = async () => {
    try {
      const res = await fetch(
        `http://127.0.0.1:${process.env.PORT ?? 8080}/api/forms/notifications/create`,
        { method: "PUT", headers: { "x-cron-secret": key } }
      );

      console.log(`[FormReminders] hourly run → ${res.status}`);
    } catch (error) {
      console.error("[FormReminders] hourly run failed:", error);
    }
  };

  // Primera pasada en la próxima hora en punto; después, cada hora.
  const firstIn = HOUR_MS - (Date.now() % HOUR_MS);

  console.log(
    `[FormReminders] scheduled, first run in ${Math.round(firstIn / 60000)} min`
  );
  setTimeout(() => {
    void run();
    setInterval(() => void run(), HOUR_MS);
  }, firstIn);
}
