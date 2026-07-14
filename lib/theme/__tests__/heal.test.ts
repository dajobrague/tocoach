import { describe, expect, it } from "vitest";

import { healThemeJson } from "../heal";
import { validateTheme } from "../schema";

// Shape real de un tenant creado por /api/auth/register: fonts como strings,
// shadow con keys sm/md, sin accent/text/border/fill. Falla validateTheme y
// el generador de CSS sirve el tema default — los colores guardados por el
// trainer nunca se aplican.
const REGISTRATION_SEED = {
  meta: { name: "Coach X", description: "Coach X's Coaching Platform" },
  colors: {
    brand: "#0070f3",
    surface: { "1": "#ffffff", "2": "#f8fafc" },
  },
  fonts: { heading: "Poppins", body: "Poppins" },
  shadow: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 2px 4px -1px rgb(0 0 0 / 0.1)",
  },
};

describe("healThemeJson", () => {
  it("makes the registration seed pass schema validation", () => {
    const healed = healThemeJson(REGISTRATION_SEED);

    expect(validateTheme(healed, "test").success).toBe(true);
  });

  it("preserves the trainer's saved colors", () => {
    const withColors = {
      ...REGISTRATION_SEED,
      colors: {
        brand: "#aa1122",
        accent: "#221133",
        surface: { "1": "#101010", "2": "#202020" },
        border: "#303030",
        fill: "#404040",
        text: { primary: "#fafafa", secondary: "#cccccc" },
      },
    };
    const healed = healThemeJson(withColors);
    const result = validateTheme(healed, "test");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.colors.brand).toBe("#aa1122");
      expect(result.data.colors.surface["1"]).toBe("#101010");
      expect(result.data.colors.fill).toBe("#404040");
    }
  });

  it("coerces string fonts into {family, weight} keeping the family", () => {
    const healed = healThemeJson(REGISTRATION_SEED);
    const result = validateTheme(healed, "test");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fonts.heading.family).toContain("Poppins");
      expect(result.data.fonts.body.family).toContain("Poppins");
    }
  });

  it("maps legacy shadow {sm, md} onto {e1, e2}", () => {
    const healed = healThemeJson(REGISTRATION_SEED);
    const result = validateTheme(healed, "test");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shadow.e1).toBe("0 1px 2px 0 rgb(0 0 0 / 0.05)");
      expect(result.data.shadow.e2).toBe("0 2px 4px -1px rgb(0 0 0 / 0.1)");
    }
  });

  it("leaves an already-valid theme unchanged", () => {
    const valid = {
      meta: { name: "Ok" },
      fonts: {
        heading: { family: "Inter, system-ui, sans-serif", weight: 600 },
        body: { family: "Inter, system-ui, sans-serif", weight: 400 },
      },
      colors: {
        brand: "#226CE0",
        accent: "#f5f9ff",
        text: { primary: "#ffffff", secondary: "#cccccc" },
        surface: { "1": "#161516", "2": "#2e2e2e" },
        border: "#dcdbdb",
        fill: "#2e2e2e",
      },
      radius: { sm: 6, md: 8, lg: 12, xl: 16 },
      shadow: {
        e1: "0 1px 2px rgba(14, 165, 233, 0.08)",
        e2: "0 4px 6px rgba(0, 0, 0, 0.07)",
      },
    };
    const healed = healThemeJson(valid);
    const result = validateTheme(healed, "test");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.colors.brand).toBe("#226CE0");
      expect(result.data.colors.surface["1"]).toBe("#161516");
      expect(result.data.fonts.heading.weight).toBe(600);
      expect(result.data.shadow.e1).toBe("0 1px 2px rgba(14, 165, 233, 0.08)");
    }
  });

  it("handles null/undefined/garbage input by returning a valid default", () => {
    for (const input of [null, undefined, "x", 42, []]) {
      const healed = healThemeJson(input);

      expect(validateTheme(healed, "test").success).toBe(true);
    }
  });

  it("preserves extra keys the UI saves (surface.3, buttons, text.muted)", () => {
    const withExtras = {
      ...REGISTRATION_SEED,
      colors: {
        ...REGISTRATION_SEED.colors,
        surface: { "1": "#ffffff", "2": "#f8fafc", "3": "#eeeeee" },
        text: { primary: "#111111", secondary: "#222222", muted: "#333333" },
        buttons: { primary: { bg: "#0070f3", text: "#fff", hover: "#005ac1" } },
      },
    };
    const healed = healThemeJson(withExtras) as Record<string, any>;

    // El schema los ignora (strip), pero el theme_json guardado no debe
    // perderlos — otras partes de la UI los leen.
    expect(healed.colors.surface["3"]).toBe("#eeeeee");
    expect(healed.colors.text.muted).toBe("#333333");
    expect(healed.colors.buttons.primary.bg).toBe("#0070f3");
    expect(validateTheme(healed, "test").success).toBe(true);
  });
});
