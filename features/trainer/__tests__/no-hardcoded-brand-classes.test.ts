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
