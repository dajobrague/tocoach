import { describe, expect, it } from "vitest";

import { __apcaLcForTest, pickForegroundHSL } from "../color-utils";

describe("pickForegroundHSL (APCA-W3 / SAPC-4g)", () => {
  it("elige blanco sobre marcas oscuras", () => {
    expect(pickForegroundHSL("#0f172a")).toBe("0 0% 100%"); // slate-900
    expect(pickForegroundHSL("#7c2d12")).toBe("0 0% 100%"); // marrón oscuro
  });

  it("elige oscuro sobre primarios pastel (el caso que motivó el fix original)", () => {
    expect(pickForegroundHSL("#fde047")).toBe("222 47% 11%"); // amarillo pastel
    expect(pickForegroundHSL("#a7f3d0")).toBe("222 47% 11%"); // menta pastel
  });

  it("con hex inválido cae a blanco (comportamiento actual)", () => {
    expect(pickForegroundHSL("garbage")).toBe("0 0% 100%");
  });

  it("elige blanco sobre rojos/azules saturados (Lc blanco por encima del piso de legibilidad)", () => {
    expect(pickForegroundHSL("#ef4444")).toBe("0 0% 100%");
    expect(pickForegroundHSL("#0070f3")).toBe("0 0% 100%");
    expect(pickForegroundHSL("#0ea5e9")).toBe("0 0% 100%");
  });

  it("elige oscuro sobre amarillos/verdes pastel (Lc blanco por debajo del piso)", () => {
    expect(pickForegroundHSL("#FFD500")).toBe("222 47% 11%");
    expect(pickForegroundHSL("#acd933")).toBe("222 47% 11%");
    expect(pickForegroundHSL("#e8b84c")).toBe("222 47% 11%");
  });

  it("elige blanco sobre el teal david-train (caso motivador de la migración a APCA)", () => {
    // Bajo WCAG 2 puro, blanco sobre #14b8a6 medía 2.49:1 (< piso 3.0) y el
    // sistema caía a oscuro. Bajo APCA, blanco alcanza Lc ≈ -53 — por encima
    // del piso de legibilidad de texto grande/negrita (Lc 45) — y es además
    // la convención para botones sólidos, así que gana pese a que oscuro
    // mide un Lc absoluto apenas mayor (~54 vs ~53).
    expect(pickForegroundHSL("#14b8a6")).toBe("0 0% 100%");
  });

  it("pin del cálculo APCA: Lc(blanco sobre #14b8a6) debe rondar -55 (52 a 58 en absoluto)", () => {
    // Ancla la matemática de apcaLc en sí misma: un typo en algún exponente
    // o coeficiente de APCA_TRC/APCA_SCALE podría seguir eligiendo blanco
    // "por casualidad" (vía el piso de legibilidad) sin que este test lo
    // note si solo miráramos el pick final.
    const lc = __apcaLcForTest("#ffffff", "#14b8a6");

    expect(lc).toBeGreaterThanOrEqual(-58);
    expect(lc).toBeLessThanOrEqual(-52);
  });

  it("referencia APCA: negro sobre blanco y blanco sobre negro coinciden con los valores publicados", () => {
    expect(__apcaLcForTest("#000000", "#ffffff")).toBeCloseTo(106.04, 1);
    expect(__apcaLcForTest("#ffffff", "#000000")).toBeCloseTo(-107.88, 1);
  });
});
