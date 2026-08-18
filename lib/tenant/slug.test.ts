import { describe, expect, it } from "vitest";

import { validateSlugFormat } from "./slug";

describe("validateSlugFormat", () => {
  it("acepta slugs ASCII url-safe", () => {
    expect(validateSlugFormat("danielmunoz")).toBe(true);
    expect(validateSlugFormat("luis-btrain")).toBe(true);
    expect(validateSlugFormat("coach123")).toBe(true);
    expect(validateSlugFormat("abc")).toBe(true);
  });

  it("normaliza mayúsculas y espacios antes de validar", () => {
    expect(validateSlugFormat("  DanielMunoz  ")).toBe(true);
  });

  // El caso del ticket: "danielmuñoz" viajaba percent-encoded en la URL y el
  // middleware nunca lo matcheaba contra tenants → portal del cliente en 404.
  it("rechaza caracteres fuera de ASCII", () => {
    expect(validateSlugFormat("danielmuñoz")).toBe(false);
    expect(validateSlugFormat("josé")).toBe(false);
    expect(validateSlugFormat("entreno💪")).toBe(false);
  });

  it("rechaza su propia forma percent-encoded", () => {
    expect(validateSlugFormat("danielmu%C3%B1oz")).toBe(false);
  });

  it("rechaza guiones en los extremos y largos inválidos", () => {
    expect(validateSlugFormat("-daniel")).toBe(false);
    expect(validateSlugFormat("daniel-")).toBe(false);
    expect(validateSlugFormat("ab")).toBe(false);
    expect(validateSlugFormat("a".repeat(31))).toBe(false);
    expect(validateSlugFormat("")).toBe(false);
  });
});
