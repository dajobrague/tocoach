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

  it("con scope .trainer-app los bloques body-prefixed no generan selectores muertos '.trainer-app body'", () => {
    const css = generateThemeCSS(defaultTheme, { scope: ".trainer-app" });

    // body es ANCESTOR de .trainer-app, no descendiente — este selector
    // nunca podría matchear nada y dejaba ganar la hoja de marca default.
    expect(css).not.toContain(".trainer-app body");
    // Debe existir una forma equivalente que sí funcione dentro del scope.
    expect(css).toMatch(
      /\.trainer-app \*\[class\*="bg-primary"\]|\.trainer-app button/
    );
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
