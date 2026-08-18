import { describe, expect, it } from "vitest";

import { TRAINER_FALLBACK_CSS, generateThemeCSS } from "../render-css";
import { defaultTheme } from "../schema";

// Contrato del generador tras retirar los "bludgeons" del modo scoped:
// - Sin scope (portal de clientes): salida byte-idéntica a la histórica —
//   los overrides por substring, el :root global y el bloque de fuentes por
//   control siguen ahí. Ese path no cambia en esta rama.
// - Con scope (.trainer-app): las variables HeroUI hacen todo el trabajo;
//   nada de overrides de clase, y los portals (modal/dropdown renderizan en
//   document.body, fuera del wrapper) se alcanzan vía body:has(.trainer-app).

describe("generateThemeCSS sin scope (invariancia del path cliente)", () => {
  const css = generateThemeCSS(defaultTheme);

  it("conserva los overrides por substring", () => {
    expect(css).toContain('html body *[class*="bg-primary"]');
    expect(css).toContain('*[class*="bg-secondary"]');
    expect(css).toContain('*[class*="bg-default"]');
  });

  it("conserva el bloque :root global", () => {
    expect(css).toMatch(/^:root \{/m);
  });

  it("conserva el bloque de fuentes por control", () => {
    expect(css).toContain("html body button,");
    expect(css).toContain('html body [data-slot="base"],');
  });
});

describe("generateThemeCSS con scope .trainer-app", () => {
  const css = generateThemeCSS(defaultTheme, { scope: ".trainer-app" });

  it("no emite overrides de clase por substring", () => {
    expect(css).not.toContain("[class*=");
  });

  it("no declara font-weight fuera de .font-heading/.font-body", () => {
    const stripped = css.replace(/\.font-(?:heading|body) \{[^}]*\}/g, "");

    expect(stripped).not.toMatch(/(^|[^-])font-weight\s*:/m);
  });

  it("alcanza los portals de HeroUI vía body:has(.trainer-app)", () => {
    expect(css).toContain("body:has(.trainer-app)");
  });

  it("emite :has() como bloque separado, nunca en lista con coma", () => {
    // Un parser sin :has() invalida la lista COMPLETA de selectores; en
    // bloques separados, .trainer-app { … } sobrevive aunque :has() caiga.
    expect(css).not.toMatch(/,\s*body:has\(/);
  });

  it("no deja ningún :root sin scope", () => {
    expect(css).not.toContain(":root");
  });

  it("las utilidades custom quedan dentro del scope", () => {
    expect(css).toContain(".trainer-app .bg-brand");
    expect(css).toContain(".trainer-app .text-accent");
    expect(css).toContain(".trainer-app .font-heading");
    expect(css).toContain(".trainer-app .font-body");
  });
});

describe("TRAINER_FALLBACK_CSS", () => {
  it("alcanza los portals y emite :has() como bloque separado", () => {
    expect(TRAINER_FALLBACK_CSS).toContain("body:has(.trainer-app)");
    expect(TRAINER_FALLBACK_CSS).not.toMatch(/,\s*body:has\(/);
  });

  it("conserva el bloque base .trainer-app con primary slate en HSL", () => {
    expect(TRAINER_FALLBACK_CSS).toMatch(/\.trainer-app \{/);
    expect(TRAINER_FALLBACK_CSS).toContain(
      "--heroui-primary: 222 47% 11% !important"
    );
  });
});
