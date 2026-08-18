// Genera lib/icons/offline-icons.ts: un bundle Iconify con SOLO los iconos
// que el código usa (grep de icon="col:name"), para registrarlos offline vía
// addCollection y no depender de api.iconify.design en runtime.
//
// Uso:
//   grep -rhoE 'icon="[a-z0-9-]+:[a-z0-9-]+"' app components features lib \
//     --include="*.tsx" | sed 's/icon="//;s/"$//' | sort -u > /tmp/icon-names.txt
//   npm i --no-save @iconify-json/solar @iconify-json/fluent \
//     @iconify-json/material-symbols @iconify-json/ph
//   node scripts/generate-icon-bundle.mjs /tmp/icon-names.txt
//
// Los iconos que se añadan después y no estén en el bundle siguen
// funcionando: la API de Iconify queda como fallback. Regenerar este
// archivo cuando se note un icono cargando "tarde".

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const listPath = process.argv[2];

if (!listPath) {
  console.error("uso: node scripts/generate-icon-bundle.mjs <icon-list.txt>");
  process.exit(1);
}

const wanted = readFileSync(listPath, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

const byPrefix = new Map();

for (const full of wanted) {
  const [prefix, name] = full.split(":");

  if (!prefix || !name) continue;
  if (!byPrefix.has(prefix)) byPrefix.set(prefix, new Set());
  byPrefix.get(prefix).add(name);
}

const collections = [];
let total = 0;
const missing = [];

for (const [prefix, names] of byPrefix) {
  const source = require(`@iconify-json/${prefix}/icons.json`);
  const out = {
    prefix,
    icons: {},
    aliases: {},
  };

  if (source.width !== undefined) out.width = source.width;
  if (source.height !== undefined) out.height = source.height;

  // Resuelve cada nombre: icono directo o alias (siguiendo la cadena de
  // parents hasta el icono real).
  const addIcon = (name) => {
    if (out.icons[name] || out.aliases[name]) return true;
    if (source.icons[name]) {
      out.icons[name] = source.icons[name];

      return true;
    }
    if (source.aliases && source.aliases[name]) {
      const alias = source.aliases[name];

      if (addIcon(alias.parent)) {
        out.aliases[name] = alias;

        return true;
      }
    }

    return false;
  };

  for (const name of names) {
    if (addIcon(name)) total += 1;
    else missing.push(`${prefix}:${name}`);
  }

  if (Object.keys(out.aliases).length === 0) delete out.aliases;
  collections.push(out);
}

if (missing.length > 0) {
  console.warn("Iconos no encontrados en sus colecciones:", missing);
}

const banner = `// AUTOGENERADO por scripts/generate-icon-bundle.mjs — no editar a mano.
// ${total} iconos de ${collections.length} colecciones, filtrados a los que
// el código usa. Se registran offline en providers.tsx (addCollection) para
// no depender de api.iconify.design en runtime; los que falten aquí siguen
// resolviendo vía API como fallback.

import type { IconifyJSON } from "@iconify/react";

export const offlineCollections: IconifyJSON[] = ${JSON.stringify(collections)} as unknown as IconifyJSON[];
`;

mkdirSync("lib/icons", { recursive: true });
writeFileSync("lib/icons/offline-icons.ts", banner);
console.log(
  `OK: ${total} iconos, ${collections.length} colecciones → lib/icons/offline-icons.ts (${Math.round(banner.length / 1024)} KB)`
);
