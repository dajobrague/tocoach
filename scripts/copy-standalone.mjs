// Post-build para el deploy standalone (Railway corre
// .next/standalone/server.js — ver Procfile y CLAUDE.md):
//
//   1. Copia .next/static y public/ dentro de .next/standalone/ para que
//      los assets sean alcanzables desde el server standalone.
//   2. Estampa el BUILD_ID dentro de la copia de sw.js.
//
// El paso 2 es lo que hace que los PWA abiertos se actualicen solos tras
// un deploy: components/service-worker-registration.tsx ya chequea
// updates al montar, cada 30 min y al volver a foreground, y recarga la
// página cuando el browser detecta un sw.js NUEVO — pero el browser solo
// lo considera nuevo si sus BYTES cambian. public/sw.js es estático y no
// cambia entre deploys, así que ese mecanismo nunca disparaba y los
// clientes quedaban corriendo el bundle viejo hasta un reload manual.
// Con el stamp, cada build produce un sw.js distinto y la cadena
// update() → updatefound → installed → reload corre sola.
//
// Solo se estampa la COPIA en standalone (no public/sw.js del repo) para
// no ensuciar el working tree en cada build.

import { appendFileSync, cpSync, readFileSync } from "node:fs";

cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
cpSync("public", ".next/standalone/public", { recursive: true });

const buildId = readFileSync(".next/BUILD_ID", "utf8").trim();

appendFileSync(
  ".next/standalone/public/sw.js",
  `\n// build: ${buildId}\n`,
  "utf8"
);

console.log(`[copy-standalone] assets copied, sw.js stamped (${buildId})`);
