import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Guard determinista contra la reintroducción de colores de marca
// hardcodeados en las superficies del shell de trainer que ya migraron a
// tokens del tema (bg-primary / text-primary / bg-primary-50). Solo cubre
// los literales retirados en esta rama — el retint completo (tiles KPI,
// gradientes, grises neutros) es Fase 2.

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

describe("shell de trainer sin colores de marca hardcodeados", () => {
  it("nutrition-update-banner: CTA y tile sin negros/slate fijos", () => {
    const src = read("../nutrition-update/nutrition-update-banner.tsx");

    expect(src).not.toContain("bg-slate-900");
    expect(src).not.toContain("bg-black");
  });

  it("side-shell: estado seleccionado sin slate fijo", () => {
    const src = read("../nav/shells/side-shell.tsx");

    expect(src).not.toContain("data-[selected=true]:bg-slate-100");
    expect(src).not.toContain("data-[selected=true]:border-slate-900");
    expect(src).not.toContain("group-data-[selected=true]:text-slate-900");
  });

  it("pending-reviews-card: sin azul fijo", () => {
    const src = read("../training/videos/pending-reviews-card.tsx");

    expect(src).not.toContain("bg-blue-600");
    expect(src).not.toContain("text-blue-600");
  });

  it("top-shell: estado activo sin slate/negro fijos", () => {
    const src = read("../nav/shells/top-shell.tsx");

    expect(src).not.toContain("bg-slate-100 text-black");
    expect(src).not.toContain('? "text-black"');
  });

  it("plantillas-dropdown: estado activo sin slate/negro fijos", () => {
    const src = read("../../../components/trainer/nav/plantillas-dropdown.tsx");

    expect(src).not.toContain("bg-slate-100 text-black");
    expect(src).not.toContain('? "text-black"');
  });
});

// El perfil de cliente (header, raíl de tabs, marco de página y los tres
// modales) migró entero a tokens semánticos. A diferencia de los ficheros del
// shell de arriba, aquí el barrido fue completo, así que el guard es genérico:
// cualquier literal de color que vuelva rompe el test.
describe("perfil de cliente sin literales de color", () => {
  const PROFILE_FILES = [
    "../../../components/dashboard/client-profile/client-profile-header.tsx",
    "../../../components/dashboard/client-profile/client-profile-tabs.tsx",
    "../../../components/dashboard/client-profile/delete-client-modal.tsx",
    "../../../components/dashboard/client-profile/update-status-modal.tsx",
    "../../../components/dashboard/edit-client-modal.tsx",
    "../../../app/trainer/dashboard/clients/[clientId]/page.tsx",
  ];

  // Paletas fijas de Tailwind: rompen el tema del tenant porque no derivan
  // de las variables --heroui-*.
  const FORBIDDEN =
    /\b(?:bg|text|border|from|via|to|ring|divide)-(?:gray|slate|zinc|neutral|stone|blue|red|green|purple|orange|indigo|sky|emerald)-\d{2,3}\b/;

  it.each(PROFILE_FILES)("%s no usa paletas fijas de Tailwind", (file) => {
    const match = read(file).match(FORBIDDEN);

    expect(match?.[0] ?? null).toBeNull();
  });

  it.each(PROFILE_FILES)("%s no fuerza blanco/negro ni bg-white", (file) => {
    const src = read(file);

    expect(src).not.toContain("text-white");
    expect(src).not.toContain("bg-white");
    expect(src).not.toContain("text-black");
  });

  it.each(PROFILE_FILES)("%s no suprime el focus ring", (file) => {
    expect(read(file)).not.toContain("focus:outline-none");
  });

  // /trainer/dashboard es un redirector que ignora la query y cae en métricas
  // salvo que localStorage.activeSection diga otra cosa, así que "?tab=clients"
  // nunca llevaba a clientes. Se navega a la ruta real.
  it("el perfil vuelve a la ruta real de clientes, no a ?tab=", () => {
    const src = read("../../../app/trainer/dashboard/clients/[clientId]/page.tsx");

    expect(src).not.toContain("/trainer/dashboard?tab=");
    expect(src).toContain('router.push("/trainer/dashboard/clients")');
  });

  it("el raíl de tabs no usa confirm nativo (congela HeroUI hasta recargar)", () => {
    const src = read(
      "../../../components/dashboard/client-profile/client-profile-tabs.tsx"
    );

    expect(src).not.toContain("window.confirm");
  });
});
