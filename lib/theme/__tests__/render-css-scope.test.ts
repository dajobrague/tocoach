import { describe, expect, it } from "vitest";

import { generateThemeCSS } from "../render-css";
import { defaultTheme } from "../schema";

describe("generateThemeCSS scope", () => {
  it("sin scope emite selectores html (comportamiento actual)", () => {
    const css = generateThemeCSS(defaultTheme);

    expect(css).toContain("html:not(.dark)");
    expect(css).not.toContain(".trainer-app");
  });

  it("con scope .trainer-app no queda ningún selector html", () => {
    const css = generateThemeCSS(defaultTheme, { scope: ".trainer-app" });

    expect(css).toContain(".trainer-app");
    expect(css).not.toMatch(/html\.light|html:not\(\.dark\)|^html /m);
  });

  it("sin scope los bloques body-prefixed usan 'html body' (byte-identidad del path default)", () => {
    const css = generateThemeCSS(defaultTheme);

    expect(css).toContain("html body");
  });

  it("con scope .trainer-app no hay selectores muertos '.trainer-app body' ni bludgeons de clase", () => {
    const css = generateThemeCSS(defaultTheme, { scope: ".trainer-app" });

    // body es ANCESTOR de .trainer-app, no descendiente — este selector
    // nunca podría matchear nada y dejaba ganar la hoja de marca default.
    expect(css).not.toContain(".trainer-app body");
    // En modo scoped las variables HeroUI hacen todo el trabajo: los
    // overrides por substring aplanaban tints/hover/variants a un sólido.
    expect(css).not.toContain("[class*=");
  });

  it("primary-foreground ya no es blanco fijo para marcas claras", () => {
    const pastel = structuredClone(defaultTheme);

    pastel.colors.brand = "#fde047";

    expect(generateThemeCSS(pastel)).toContain(
      "--heroui-primary-foreground: 222 47% 11% !important"
    );
  });

  it("el override .text-primary-foreground usa la variable calculada, no #ffffff fijo", () => {
    const pastel = structuredClone(defaultTheme);

    pastel.colors.brand = "#fde047";

    const css = generateThemeCSS(pastel);
    const rule = css.match(/\.text-primary-foreground,[\s\S]*?\{[\s\S]*?\}/);

    expect(rule).not.toBeNull();
    expect(rule?.[0]).not.toContain("#ffffff");
    expect(rule?.[0]).toContain("var(--heroui-primary-foreground)");
  });
});

describe("superficies del trainer app", () => {
  /** Tenant con lienzo oscuro: varios en producción lo tienen. */
  const darkCanvas = () => {
    const t = structuredClone(defaultTheme);

    t.colors.surface["1"] = "#111827";
    t.colors.surface["2"] = "#1F2937";
    t.colors.fill = "#374151";
    t.colors.border = "#4B5563";
    t.colors.text.primary = "#F9FAFB";
    t.colors.text.secondary = "#D1D5DB";

    return t;
  };

  it("con scope el fondo es blanco aunque el tenant traiga surface oscuro", () => {
    const css = generateThemeCSS(darkCanvas(), { scope: ".trainer-app" });

    expect(css).toContain("--heroui-background: 0 0% 100% !important;");
    expect(css).toContain("--heroui-content1: 0 0% 100% !important;");
  });

  it("con scope el body no se pinta con el surface del tenant", () => {
    const css = generateThemeCSS(darkCanvas(), { scope: ".trainer-app" });

    // La regla `body { background }` es global y lleva !important: heredarla
    // teñía la app entera con el lienzo del tenant.
    expect(css).not.toContain("background: #111827 !important;");
    expect(css).toContain("body:has(.trainer-app)");
  });

  it("con scope el texto no hereda el foreground claro del tenant", () => {
    const css = generateThemeCSS(darkCanvas(), { scope: ".trainer-app" });

    // #F9FAFB sobre blanco sería invisible.
    expect(css).not.toContain("--heroui-foreground: 210 20% 98% !important;");
  });

  it("con scope el acento del tenant SÍ se conserva", () => {
    const t = darkCanvas();

    t.colors.brand = "#7C3AED";

    const css = generateThemeCSS(t, { scope: ".trainer-app" });

    expect(css).toContain("--heroui-primary:");
    expect(css).toContain("--heroui-focus:");
    expect(css).not.toContain("--heroui-primary: 0 0% 100%");
  });

  it("con scope ningún hex oscuro del tenant sobrevive en la hoja", () => {
    const css = generateThemeCSS(darkCanvas(), { scope: ".trainer-app" });

    // Incluye --color-surface-1 y compañía: hoy ningún componente de trainer
    // usa esas utilidades, pero un `bg-surface-1` futuro volvería a oscurecer.
    for (const hex of ["#111827", "#1F2937", "#374151", "#4B5563"]) {
      expect(css).not.toContain(hex);
    }
  });

  it("sin scope (portal de cliente) el tenant sigue pintando el lienzo", () => {
    const css = generateThemeCSS(darkCanvas());

    expect(css).toContain("background: #111827 !important;");
    expect(css).not.toContain("--heroui-background: 0 0% 100% !important;");
  });
});
