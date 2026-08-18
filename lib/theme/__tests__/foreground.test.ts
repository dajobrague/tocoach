import { describe, expect, it } from "vitest";

import { pickForegroundHSL } from "../color-utils";

describe("pickForegroundHSL", () => {
  it("elige blanco sobre marcas oscuras", () => {
    expect(pickForegroundHSL("#0f172a")).toBe("0 0% 100%"); // slate-900
    expect(pickForegroundHSL("#7c2d12")).toBe("0 0% 100%"); // marrón oscuro
  });

  it("elige oscuro sobre primarios pastel (el caso que motivó el fix)", () => {
    expect(pickForegroundHSL("#fde047")).toBe("222 47% 11%"); // amarillo
    expect(pickForegroundHSL("#a7f3d0")).toBe("222 47% 11%"); // menta pastel
  });

  it("con hex inválido cae a blanco (comportamiento actual)", () => {
    expect(pickForegroundHSL("garbage")).toBe("0 0% 100%");
  });

  it("elige blanco cuando supera el piso 3:1 aunque el oscuro contraste más", () => {
    // Regla ii: blanco gana si alcanza 3.0:1 — la convención pre-branch (y
    // el danger=white hardcodeado de HeroUI) para rojos/verdes saturados.
    expect(pickForegroundHSL("#ef4444")).toBe("0 0% 100%"); // 3.76:1
    expect(pickForegroundHSL("#059669")).toBe("0 0% 100%"); // 3.77:1
  });

  it("mantiene oscuro bajo el piso 3:1 (teal david-train)", () => {
    expect(pickForegroundHSL("#14b8a6")).toBe("222 47% 11%"); // blanco 2.49:1
  });
});
