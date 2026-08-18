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

  it("primary-foreground ya no es blanco fijo para marcas claras", () => {
    const pastel = structuredClone(defaultTheme);

    pastel.colors.brand = "#fde047";

    expect(generateThemeCSS(pastel)).toContain(
      "--heroui-primary-foreground: 222 47% 11% !important"
    );
  });
});
