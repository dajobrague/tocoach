import { describe, expect, it } from "vitest";

import {
  DARK_NEUTRALS,
  DERIVED_NEUTRALS,
  isDarkCanvas,
  brandColorHint,
  hasLegacyCustomColors,
  simplifyBrandColors,
} from "../brand-colors";
import { brandInk, resolveClientSurface } from "../client-surface";
import { getContrastRatio } from "../contrast";
import { healThemeJson } from "../heal";
import { generateThemeCSS, resolveTenantTheme } from "../render-css";
import { defaultTheme, validateTheme } from "../schema";

const NEUTRALS = {
  text: DERIVED_NEUTRALS.text,
  surface: DERIVED_NEUTRALS.surface,
  border: DERIVED_NEUTRALS.border,
  fill: DERIVED_NEUTRALS.fill,
};

describe("simplifyBrandColors", () => {
  it("tema completo con textos/fondos personalizados → solo brand/accent + neutros", () => {
    const full = {
      brand: "#14b8a6",
      accent: "#0d9488",
      text: { primary: "#6DAEDB", secondary: "#aaaaaa", muted: "#cccccc" },
      surface: { "1": "#08415c", "2": "#026de2", "3": "#000000" },
      border: "#ffffff",
      fill: "#08415c",
      buttons: { primary: { bg: "#000", text: "#fff", hover: "#111" } },
      shadows: { light: "rgba(0,0,0,0.1)" },
    };

    const out = simplifyBrandColors(full, {
      brand: "#ef4444",
      accent: "f59e0b",
    });

    expect(out).toEqual({
      brand: "#ef4444",
      accent: "#f59e0b",
      auto: true,
      scheme: "light",
      ...NEUTRALS,
      // Claves que no son color editable se conservan.
      shadows: { light: "rgba(0,0,0,0.1)" },
    });
    expect(out).not.toHaveProperty("buttons");
  });

  it("tema legacy parcial (text {primary,secondary}, sin surface) no rompe", () => {
    const legacy = { brand: "#0E3158", text: { primary: "#0f172a" } };

    const out = simplifyBrandColors(legacy, { brand: undefined });

    expect(out.brand).toBe("#0e3158");
    expect(out.accent).toBe("#0e3158");
    expect(out.text).toEqual(DERIVED_NEUTRALS.text);
  });

  it("solo principal: el secundario cae al principal; basura → default", () => {
    expect(simplifyBrandColors(undefined, { brand: "#22c55e" })).toMatchObject({
      brand: "#22c55e",
      accent: "#22c55e",
      auto: true,
    });
    expect(simplifyBrandColors(null, { brand: "nope" }).brand).toBe(
      defaultTheme.colors.brand
    );
  });

  it("el resultado pasa heal + validateTheme", () => {
    const theme = healThemeJson({
      colors: simplifyBrandColors(
        { text: "legacy-string" },
        { brand: "#f97316" }
      ),
    });

    expect(validateTheme(theme, "t").success).toBe(true);
  });
});

describe("derivación en el pipeline", () => {
  const render = (themeJson: unknown) =>
    generateThemeCSS(
      resolveTenantTheme({ theme_json: themeJson as any, theme_slug: "t" }, "t")
    );

  it("tema con solo principal: neutros legibles y texto de botón automático", () => {
    const theme = resolveTenantTheme(
      {
        theme_json: healThemeJson({
          colors: simplifyBrandColors(undefined, { brand: "#fde047" }),
        }) as any,
        theme_slug: "t",
      },
      "t"
    );
    const s = resolveClientSurface(theme.colors);

    expect(theme.colors.brand).toBe("#fde047");
    expect(getContrastRatio(s.foreground, s.c1)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(s.d500, s.background)).toBeGreaterThanOrEqual(4.5);
    // Amarillo pastel → texto oscuro sobre el botón.
    expect(generateThemeCSS(theme)).toContain(
      "--heroui-primary-foreground: 222 47% 11%"
    );
  });

  it("tenant que no re-guarda: su CSS no cambia (sin migración)", () => {
    const legacy = {
      colors: {
        brand: "#14b8a6",
        accent: "#0d9488",
        text: { primary: "#1f2937", secondary: "#4b5563" },
        surface: { "1": "#fffaf0", "2": "#fef3c7" },
        border: "#e5e7eb",
        fill: "#fef3c7",
      },
    };

    // El pipeline sigue leyendo sus valores (lienzo crema) tal cual.
    expect(render(legacy)).not.toBe(
      render(healThemeJson({ colors: simplifyBrandColors(legacy.colors, {}) }))
    );
    expect(
      resolveTenantTheme({ theme_json: legacy as any, theme_slug: "t" }, "t")
        .colors.surface["1"]
    ).toBe("#fffaf0");
  });

  it("tras guardar con el editor simple el CSS es el del default con otra marca", () => {
    const saved = healThemeJson({
      colors: simplifyBrandColors(
        { surface: { "1": "#08415c" }, text: { primary: "#6DAEDB" } },
        { brand: defaultTheme.colors.brand, accent: defaultTheme.colors.accent }
      ),
    });

    expect(render(saved)).toBe(generateThemeCSS(defaultTheme));
  });
});

describe("hasLegacyCustomColors", () => {
  it("detecta textos/fondos distintos de los neutros", () => {
    expect(hasLegacyCustomColors({ surface: { "1": "#08415c" } })).toBe(true);
    expect(hasLegacyCustomColors({ text: { primary: "#6DAEDB" } })).toBe(true);
  });

  it("false para temas ya simples, neutros o vacíos", () => {
    expect(
      hasLegacyCustomColors(
        simplifyBrandColors(undefined, { brand: "#000000" })
      )
    ).toBe(false);
    expect(hasLegacyCustomColors({ ...NEUTRALS, brand: "#ff0000" })).toBe(
      false
    );
    expect(hasLegacyCustomColors({ text: { primary: "#0F172A" } })).toBe(false);
    expect(hasLegacyCustomColors(undefined)).toBe(false);
  });
});

describe("brandColorHint", () => {
  it("avisa con principales muy pálidos", () => {
    expect(brandColorHint("#fde047")).toMatch(/muy claro/);
    expect(brandColorHint("#f1f5f9")).toMatch(/muy claro/);
  });

  it("no avisa con colores de marca normales ni con hex inválido", () => {
    for (const hex of ["#0ea5e9", "#14b8a6", "#ef4444", "#0f172a", "#f59e0b"]) {
      expect(brandColorHint(hex)).toBeNull();
    }
    expect(brandColorHint("")).toBeNull();
  });
});

describe("Fondo oscuro (scheme: dark)", () => {
  // Forma real de los tenants oscuros de prod (lienzos #1f1b1b, #151615,
  // #161615, #161516), con textos claros personalizados.
  const darkTenant = {
    brand: "#e11d48",
    accent: "#f43f5e",
    text: { primary: "#ffffff", secondary: "#b5b5b5", muted: "#8a8a8a" },
    surface: { "1": "#1f1b1b", "2": "#2a2525", "3": "#332d2d" },
    border: "#3d3636",
    fill: "#2a2525",
  };
  const surfaceOf = (themeJson: unknown) =>
    resolveClientSurface(
      resolveTenantTheme({ theme_json: themeJson as any, theme_slug: "t" }, "t")
        .colors
    );

  it("isDarkCanvas decide por luminancia, no por hex exacto", () => {
    for (const hex of ["#1f1b1b", "#151615", "#161615", "#161516", "#0e3158"]) {
      expect(isDarkCanvas({ surface: { "1": hex } })).toBe(true);
    }
    expect(isDarkCanvas({ surface: { "1": "#ffffff" } })).toBe(false);
    expect(isDarkCanvas({ surface: { "1": "#fffaf0" } })).toBe(false);
    expect(isDarkCanvas({ text: { primary: "#000" } })).toBe(false);
    expect(isDarkCanvas(undefined)).toBe(false);
  });

  it("guarda los neutros oscuros derivados y scheme junto a auto", () => {
    const out = simplifyBrandColors(darkTenant, {
      brand: "#e11d48",
      scheme: "dark",
    });

    expect(out).toMatchObject({
      auto: true,
      scheme: "dark",
      surface: DARK_NEUTRALS.surface,
      text: DARK_NEUTRALS.text,
      border: DARK_NEUTRALS.border,
      fill: DARK_NEUTRALS.fill,
    });
    expect(simplifyBrandColors(darkTenant, {}).scheme).toBe("light");
    // heal conserva scheme/auto (keys extra) y el resultado valida.
    const healed = healThemeJson({ colors: out });

    expect(healed.colors).toMatchObject({ auto: true, scheme: "dark" });
    expect(validateTheme(healed, "t").success).toBe(true);
  });

  it("un tenant oscuro que re-guarda con el interruptor sigue oscuro y legible", () => {
    const before = surfaceOf({ colors: darkTenant });
    const after = surfaceOf(
      healThemeJson({
        colors: simplifyBrandColors(darkTenant, {
          brand: darkTenant.brand,
          accent: darkTenant.accent,
          scheme: "dark",
        }),
      })
    );

    expect(before.dark).toBe(true);
    expect(after.dark).toBe(true);
    // Misma familia de lienzo: casi negro, diferencia de contraste mínima.
    expect(getContrastRatio(after.background, before.background)).toBeLessThan(
      1.1
    );
    expect(getContrastRatio(after.foreground, after.c1)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(getContrastRatio(after.d500, after.c1)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(after.d400, after.c1)).toBeGreaterThanOrEqual(3);
    // Los neutros oscuros se usan tal cual (resolveClientSurface los acepta).
    expect(after.d300).toBe(DARK_NEUTRALS.border);
    expect(after.foreground).toBe(DARK_NEUTRALS.text.primary);
  });

  it("con principal pálido sobre oscuro, la marca como texto sigue legible", () => {
    const theme = resolveTenantTheme(
      {
        theme_json: healThemeJson({
          colors: simplifyBrandColors(undefined, {
            brand: "#1e3a8a",
            scheme: "dark",
          }),
        }) as any,
        theme_slug: "t",
      },
      "t"
    );
    const s = resolveClientSurface(theme.colors);
    const ink = brandInk(theme.colors.brand, s.background, s.foreground);

    expect(getContrastRatio(ink, s.background)).toBeGreaterThanOrEqual(4.5);
    expect(generateThemeCSS(theme)).toContain(
      "--heroui-primary-foreground: 0 0% 100%"
    );
  });

  it("hasLegacyCustomColors compara contra los neutros de su esquema", () => {
    expect(hasLegacyCustomColors(darkTenant)).toBe(true);
    expect(hasLegacyCustomColors({ ...DARK_NEUTRALS, brand: "#e11d48" })).toBe(
      false
    );
  });
});
