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
});
