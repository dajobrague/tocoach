import { describe, expect, it } from "vitest";

import { TRAINER_FALLBACK_CSS, generateThemeCSS } from "../render-css";
import { getContrastRatio } from "../contrast";
import { defaultTheme } from "../schema";

// Contrato del generador:
// - Sin scope (portal de clientes) y con scope (.trainer-app): las variables
//   HeroUI hacen todo el trabajo. Nada de overrides de clase por substring
//   (*[class*="bg-primary"] aplanaba cada tint/hover a un sólido) ni bloque
//   de fuentes por control (forzaba el peso de cuerpo en botones y chips).
// - Con scope, los portals (modal/dropdown renderizan en document.body,
//   fuera del wrapper) se alcanzan vía body:has(.trainer-app).

describe("generateThemeCSS sin scope (portal de cliente)", () => {
  const css = generateThemeCSS(defaultTheme);

  it("no emite overrides de clase por substring", () => {
    expect(css).not.toContain("[class*=");
    expect(css).not.toContain('[data-color="primary"]');
  });

  it("conserva el bloque :root global", () => {
    expect(css).toMatch(/^:root \{/m);
  });

  it("la fuente de cuerpo va en el body, no forzada por control", () => {
    expect(css).not.toContain("html body button,");
    expect(css).toMatch(/html body \{\s*font-family:/);
  });

  it(".font-body no fuerza peso (font-semibold sobrevive)", () => {
    const rule = css.match(/\.font-body \{[^}]*\}/)?.[0] ?? "";

    expect(rule).toContain("font-family");
    expect(rule).not.toContain("font-weight");
  });

  it("marca legible: sin regla de tinta para .text-primary", () => {
    const blue = structuredClone(defaultTheme);

    blue.colors.brand = "#0070f3";

    expect(generateThemeCSS(blue)).not.toContain(".text-primary {");
  });

  it("marca pálida: .text-primary usa una tinta oscurecida, el relleno la marca cruda", () => {
    const lime = structuredClone(defaultTheme);

    lime.colors.brand = "#acd933";

    const out = generateThemeCSS(lime);
    const ink = out.match(
      /html \.text-primary \{\s*color: (#[0-9a-f]{6});/i
    )?.[1];

    expect(ink).toBeDefined();
    expect(getContrastRatio(ink!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(out).toContain(".bg-brand { background-color: #acd933");
  });

  it("los foregrounds semánticos se calculan, no son blanco fijo", () => {
    const pale = structuredClone(defaultTheme);

    pale.semantic = {
      success: "#86efac",
      warning: "#fde047",
      error: "#fca5a5",
    };

    const out = generateThemeCSS(pale);

    expect(out).toContain(
      "--heroui-success-foreground: 222 47% 11% !important"
    );
    expect(out).toContain(
      "--heroui-warning-foreground: 222 47% 11% !important"
    );
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
