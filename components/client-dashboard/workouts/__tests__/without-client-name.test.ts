import { describe, expect, it } from "vitest";

import { withoutClientName } from "../available-sessions-list";

describe("withoutClientName", () => {
  it("quita el sufijo exacto con el nombre del cliente", () => {
    expect(
      withoutClientName("Empuje Horizontal 1 - Jose Guerrero", "Jose Guerrero")
    ).toBe("Empuje Horizontal 1");
  });

  it("no toca nombres sin el sufijo o con otro nombre", () => {
    expect(withoutClientName("Salto", "Jose Guerrero")).toBe("Salto");
    expect(withoutClientName("Fuerza - Ana Ruiz", "Jose Guerrero")).toBe(
      "Fuerza - Ana Ruiz"
    );
    expect(withoutClientName(null, "Jose Guerrero")).toBeNull();
  });
});
