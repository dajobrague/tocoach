import type { ThemeConfig } from "../schema";

import { describe, expect, it } from "vitest";

import { brandInk, resolveClientSurface } from "../client-surface";
import { getContrastRatio } from "../contrast";
import { defaultTheme } from "../schema";

// Paletas reales de producción (tenants.theme_json, Sep 2026) que rompían
// la escala neutra cuando se mapeaba el hex del trainer tal cual.
function palette(
  over: Partial<{
    s1: string;
    s2: string;
    tp: string;
    ts: string;
    border: string;
    fill: string;
  }>
): ThemeConfig["colors"] {
  const c = structuredClone(defaultTheme.colors);

  if (over.s1) c.surface["1"] = over.s1;
  if (over.s2) c.surface["2"] = over.s2;
  if (over.tp) c.text.primary = over.tp;
  if (over.ts) c.text.secondary = over.ts;
  if (over.border) c.border = over.border;
  if (over.fill) c.fill = over.fill;

  return c;
}

const ratio = getContrastRatio;

describe("resolveClientSurface", () => {
  it("respeta una paleta sana tal cual (david-train)", () => {
    const s = resolveClientSurface(
      palette({
        s1: "#ffffff",
        s2: "#f0fdfa",
        tp: "#1f2937",
        ts: "#6b7280",
        border: "#9ca3af",
        fill: "#ccfbf1",
      })
    );

    expect(s.background).toBe("#ffffff");
    expect(s.foreground).toBe("#1f2937");
    expect(s.d100).toBe("#f0fdfa");
    expect(s.d200).toBe("#ccfbf1");
    expect(s.d300).toBe("#9ca3af");
    expect(s.d500).toBe("#6b7280");
  });

  it("un fill saturado no se cuela como 'gris' (emicoach10 #08415c)", () => {
    const s = resolveClientSurface(palette({ s1: "#ffffff", fill: "#08415c" }));

    expect(s.d200).not.toBe("#08415c");
    expect(ratio(s.d200, "#ffffff")).toBeLessThanOrEqual(1.6);
  });

  it("un borde blanco sobre blanco se reemplaza por uno visible (javimorenonutri)", () => {
    const s = resolveClientSurface(
      palette({ s1: "#ffffff", border: "#ffffff" })
    );

    expect(ratio(s.d300, "#ffffff")).toBeGreaterThanOrEqual(1.15);
  });

  it("texto principal ilegible cae a uno legible (fuertedenuevo #6DAEDB)", () => {
    const s = resolveClientSurface(
      palette({ s1: "#FFFFFF", tp: "#6DAEDB", ts: "#7d9cc8" })
    );

    expect(ratio(s.foreground, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(ratio(s.d500, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("texto oscuro sobre lienzo oscuro se invierte (carrillopt)", () => {
    const s = resolveClientSurface(
      palette({ s1: "#1f1b1b", s2: "#fffbeb", tp: "#030202", ts: "#050404" })
    );

    expect(ratio(s.foreground, "#1f1b1b")).toBeGreaterThanOrEqual(4.5);
    expect(ratio(s.d500, "#1f1b1b")).toBeGreaterThanOrEqual(4.5);
    // s2 claro sobre lienzo oscuro no sirve como superficie sutil
    expect(s.d100).not.toBe("#fffbeb");
  });

  it("tema oscuro sano conserva sus superficies (coachjoseca)", () => {
    const s = resolveClientSurface(
      palette({
        s1: "#161516",
        s2: "#333232",
        tp: "#ffffff",
        ts: "#e4e3e3",
        border: "#dcdbdb",
        fill: "#333232",
      })
    );

    expect(s.foreground).toBe("#ffffff");
    expect(s.d100).toBe("#333232");
    expect(s.d500).toBe("#e4e3e3");
  });

  it("text-default-400 llega siempre a 3:1 sobre el lienzo", () => {
    for (const s1 of ["#ffffff", "#161516", "#f8f9fa"]) {
      const s = resolveClientSurface(palette({ s1, border: "#e2e8f0" }));

      expect(ratio(s.d400, s.background)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("brandInk", () => {
  it("marca legible queda intacta", () => {
    expect(brandInk("#0070f3", "#ffffff", "#11181C")).toBe("#0070f3");
  });

  it("lima/amarillo sobre blanco se oscurecen hasta 4.5:1", () => {
    for (const brand of ["#acd933", "#FFD500", "#08d03a", "#e8b84c"]) {
      const ink = brandInk(brand, "#ffffff", "#11181C");

      expect(ratio(ink, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("marca oscura sobre lienzo oscuro se aclara", () => {
    const ink = brandInk("#241037", "#161516", "#FAFAFA");

    expect(ratio(ink, "#161516")).toBeGreaterThanOrEqual(4.5);
  });
});
