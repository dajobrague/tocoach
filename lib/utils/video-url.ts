// Resolución de URLs de videos para el reproductor de demo del entrenador
// y la validación del input "URL del Video Tutorial" en la biblioteca de
// ejercicios.
//
// Diseño defensivo: la detección de archivo directo (Supabase Storage,
// CDNs, cualquier `.mp4/.webm/.ogg/.mov/.m4v`) sucede ANTES que cualquier
// parseo por host. Eso garantiza que las URLs ya subidas a `exercise-videos`
// y `client-exercise-videos` siempre caen en `direct` y se renderizan con
// `<video src>` exactamente igual que antes — sin importar cómo evolucione
// el resto del parser.
//
// Plataformas externas soportadas para incrustar:
//   - YouTube classic (`watch?v=ID`, `youtu.be/ID`)
//   - YouTube Shorts (`youtube.com/shorts/ID`)         ← antes fallaba
//   - YouTube Embed (`youtube.com/embed/ID`)
//   - YouTube Live (`youtube.com/live/ID`)
//   - youtube-nocookie.com variantes
//   - m.youtube.com variantes
//   - Vimeo público (`vimeo.com/ID`)
//   - Vimeo con hash de privacidad (`vimeo.com/ID/HASH` → `?h=HASH`)
//   - Vimeo player (`player.vimeo.com/video/ID`)
//
// Cualquier otro host (Instagram Reels, TikTok, Facebook Watch, etc.) cae
// en `unsupported`. Esos sitios bloquean el iframing por terceros con
// X-Frame-Options/CSP y no hay forma confiable de reproducirlos en línea
// sin pasar por sus widgets oficiales (con chrome propio, branding, etc.).
// La UI debe guiar al trainer a subir el archivo en su lugar.

export type VideoEmbed =
  | { type: "youtube"; embedUrl: string }
  | { type: "vimeo"; embedUrl: string }
  | { type: "direct"; embedUrl: string }
  | { type: "unsupported"; originalUrl: string };

const DIRECT_FILE_REGEX = /\.(mp4|webm|ogg|mov|m4v)$/;

/**
 * Resuelve la URL de un video tutorial al formato necesario para
 * reproducirlo. Diseñada para no romper nunca el path de archivo directo:
 * cualquier URL con extensión de video conocida cae en `direct` antes de
 * mirar el host.
 */
export function getVideoEmbed(rawUrl: string | null | undefined): VideoEmbed {
  const url = (rawUrl ?? "").trim();

  if (!url) return { type: "unsupported", originalUrl: "" };

  // Intento de parseo "blando": si falla, igual probamos detectar archivo
  // directo a partir del string crudo antes de rendirnos.
  let parsed: URL | null = null;

  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }

  // 1) DETECCIÓN DE ARCHIVO DIRECTO — primera, intencional.
  // Funciona para Supabase Storage, S3, cualquier CDN y URLs sin host
  // bien formado. Strip de query/hash para que `?t=123` o `#frag` no
  // disfracen la extensión. Restricción de seguridad: solo aceptamos
  // http(s) — descartar `javascript:`, `data:`, `file:` aunque tengan
  // pinta de `.mp4`. El navegador no los reproduciría igual, pero no
  // queremos meterlos jamás en `<video src>`.
  const protocol = parsed?.protocol;
  const looksHttp = !parsed || protocol === "http:" || protocol === "https:";
  const pathForExt = (
    parsed?.pathname ??
    url.split("?")[0]?.split("#")[0] ??
    url
  ).toLowerCase();

  if (looksHttp && DIRECT_FILE_REGEX.test(pathForExt)) {
    return { type: "direct", embedUrl: url };
  }

  // Si no pudimos parsear el URL y tampoco es un archivo directo,
  // no hay forma segura de incrustarlo.
  if (!parsed) return { type: "unsupported", originalUrl: url };

  const host = parsed.hostname
    .replace(/^www\./, "")
    .replace(/^m\./, "")
    .toLowerCase();

  // 2) YOUTUBE
  if (host === "youtu.be") {
    const id = parsed.pathname.replace(/^\//, "").split("/")[0]?.trim();

    if (id) return youtubeEmbed(id);
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const segments = parsed.pathname.split("/").filter(Boolean);
    const first = segments[0]?.toLowerCase();

    if (first === "watch") {
      const id = parsed.searchParams.get("v")?.trim();

      if (id) return youtubeEmbed(id);
    } else if (
      (first === "shorts" ||
        first === "embed" ||
        first === "live" ||
        first === "v") &&
      segments[1]
    ) {
      return youtubeEmbed(segments[1]);
    }
  }

  // 3) VIMEO
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const segments = parsed.pathname.split("/").filter(Boolean);
    let id: string | undefined;
    let hash: string | undefined;

    // Vimeo IDs son siempre numéricos. Tomamos el primer segmento numérico
    // que veamos (cubre `vimeo.com/ID`, `vimeo.com/channels/foo/ID`,
    // `vimeo.com/groups/foo/videos/ID`, `player.vimeo.com/video/ID`). Si
    // hay un segmento no-numérico inmediatamente después, es el hash de
    // privacidad de un video unlisted.
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;

      if (/^\d+$/.test(seg)) {
        id = seg;
        const next = segments[i + 1];

        if (next && !/^\d+$/.test(next)) hash = next;
        break;
      }
    }

    if (id) {
      const safeId = encodeURIComponent(id);
      const base = `https://player.vimeo.com/video/${safeId}`;
      const params = new URLSearchParams({ autoplay: "1" });

      if (hash) params.set("h", hash);

      return { type: "vimeo", embedUrl: `${base}?${params.toString()}` };
    }
  }

  return { type: "unsupported", originalUrl: url };
}

function youtubeEmbed(rawId: string): VideoEmbed {
  // Sanitizamos por paranoia — los IDs reales son [A-Za-z0-9_-]{11} y
  // cortamos cualquier query string remanente (`youtu.be/ID?si=...`).
  const safeId = encodeURIComponent(
    rawId
      .split("?")[0]!
      .split("&")[0]!
      .replace(/[^A-Za-z0-9_-]/g, "")
  );

  if (!safeId) return { type: "unsupported", originalUrl: rawId };

  return {
    type: "youtube",
    embedUrl: `https://www.youtube-nocookie.com/embed/${safeId}?rel=0&modestbranding=1&autoplay=1&playsinline=1`,
  };
}

/**
 * `true` cuando el campo está vacío o el URL es uno que sí podemos
 * incrustar (YouTube/Vimeo/archivo directo). Útil para validación de
 * inputs opcionales: empty no es un error.
 */
export function isSupportedTutorialUrl(
  rawUrl: string | null | undefined
): boolean {
  const url = (rawUrl ?? "").trim();

  if (!url) return true;

  return getVideoEmbed(url).type !== "unsupported";
}

// Hosts que aceptamos como tutorial; usado para no marcar como inválida
// una URL que el trainer aún está escribiendo en un host soportado.
const SUPPORTED_HOSTS = new Set([
  "youtu.be",
  "youtube.com",
  "youtube-nocookie.com",
  "vimeo.com",
  "player.vimeo.com",
]);

/**
 * `true` cuando el campo tiene algo escrito que claramente NO podemos
 * incrustar — para mostrar un warning rojo bajo el input. Diseñado para
 * no fastidiar mientras el trainer está tipeando: si la URL aún no parsea
 * (`htt`, `https:/`) o el host es uno que sí soportamos pero el path
 * está incompleto (`youtube.com/watc`), no avisamos hasta que termine.
 *
 * Cuando un trainer pega un URL sin `https://` (p. ej.
 * `youtube.com/watch?v=ABC`) tampoco avisamos: `new URL` falla y
 * devolvemos `false`. El render-side tiene un fallback claro para esos
 * casos al cliente, así que el peor escenario es UI no-óptima, no datos
 * corruptos.
 */
export function isUnsupportedExternalUrl(
  rawUrl: string | null | undefined
): boolean {
  const url = (rawUrl ?? "").trim();

  if (!url) return false;

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Esquemas raros (`javascript:`, `data:`, `file:`) son siempre warning.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return true;
  }

  const host = parsed.hostname
    .replace(/^www\./, "")
    .replace(/^m\./, "")
    .toLowerCase();

  // Si está escribiendo en un host que sí soportamos, no molestamos
  // aunque el path aún no sea válido — terminará de escribir.
  if (SUPPORTED_HOSTS.has(host)) return false;

  return getVideoEmbed(url).type === "unsupported";
}
