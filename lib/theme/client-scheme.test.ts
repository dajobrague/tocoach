import { describe, expect, it } from "vitest";

import { DARK_NEUTRALS, withCanvasScheme } from "./brand-colors";
import { renderInlineThemeCSS } from "./render-css";
import { defaultTheme } from "./schema";

describe("modo día/noche del cliente", () => {
  it("cambia los neutros y deja la marca intacta", () => {
    const dark = withCanvasScheme(defaultTheme.colors, "dark");

    expect(dark.surface["1"]).toBe(DARK_NEUTRALS.surface["1"]);
    expect(dark.text.primary).toBe(DARK_NEUTRALS.text.primary);
    expect(dark.brand).toBe(defaultTheme.colors.brand);
  });

  it("el CSS inline cambia con el esquema y sin esquema queda como estaba", () => {
    const ctx = { theme_json: defaultTheme, theme_slug: "default" };
    const base = renderInlineThemeCSS(ctx, "t");

    expect(base).not.toBeNull();
    expect(renderInlineThemeCSS(ctx, "t", null)).toBe(base);
    expect(renderInlineThemeCSS(ctx, "t", "dark")).not.toBe(base);
  });
});
