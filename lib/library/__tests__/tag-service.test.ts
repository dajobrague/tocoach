import { describe, expect, it, vi } from "vitest";

import { MAX_TAG_LENGTH } from "../parse-tags";
import {
  isLibraryTagKind,
  parseTagName,
  TagConflictError,
  TagService,
  TagValidationError,
} from "../tag-service";

describe("parseTagName", () => {
  it("trims and keeps names within the item-tag bounds", () => {
    expect(parseTagName("  Vegano ")).toBe("Vegano");
    expect(parseTagName("x".repeat(MAX_TAG_LENGTH))).toHaveLength(
      MAX_TAG_LENGTH
    );
  });

  it("rejects blanks, non-strings and over-long names", () => {
    expect(() => parseTagName("   ")).toThrow(TagValidationError);
    expect(() => parseTagName(undefined)).toThrow(TagValidationError);
    expect(() => parseTagName("x".repeat(MAX_TAG_LENGTH + 1))).toThrow(
      TagValidationError
    );
  });
});

describe("isLibraryTagKind", () => {
  it("accepts the three libraries only", () => {
    expect(isLibraryTagKind("recipe")).toBe(true);
    expect(isLibraryTagKind("exercise")).toBe(true);
    expect(isLibraryTagKind("program")).toBe(true);
    expect(isLibraryTagKind("folder")).toBe(false);
    expect(isLibraryTagKind(null)).toBe(false);
  });
});

/** Minimal chainable Supabase stub: every builder call returns itself and
 *  awaiting it resolves to the queued result. */
function fakeClient(results: Array<{ data?: unknown; error?: unknown }>) {
  const queue = [...results];
  const rpc = vi.fn(async () => queue.shift() ?? { data: null, error: null });
  const builder: Record<string, unknown> = {};
  const chain = () => builder;

  for (const method of [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "single",
    "maybeSingle",
  ]) {
    builder[method] = vi.fn(chain);
  }
  builder.then = (resolve: (value: unknown) => void) =>
    resolve(queue.shift() ?? { data: null, error: null });

  return {
    client: { from: vi.fn(chain), rpc } as never,
    rpc,
    builder,
  };
}

const TAG = {
  id: "t1",
  tenant_host: "acme",
  kind: "recipe" as const,
  name: "vegano",
  created_at: "2026-09-07",
};

describe("TagService", () => {
  it("create returns the existing row instead of failing on a duplicate", async () => {
    const { client } = fakeClient([
      { data: null, error: { code: "23505", message: "dup" } },
      { data: [{ ...TAG, name: "Vegano" }], error: null },
    ]);
    const result = await new TagService(client).create(
      "acme",
      "recipe",
      "vegano"
    );

    expect(result).toEqual({ tag: { ...TAG, name: "Vegano" }, created: false });
  });

  it("rename updates the registry, then retags every item via the kind's RPC", async () => {
    const { client, rpc } = fakeClient([
      { data: TAG, error: null },
      { data: { ...TAG, name: "Vegana" }, error: null },
      { data: null, error: null },
    ]);
    const renamed = await new TagService(client).rename("acme", "t1", "Vegana");

    expect(renamed?.name).toBe("Vegana");
    expect(rpc).toHaveBeenCalledWith("replace_recipe_tag", {
      p_tenant_host: "acme",
      p_old_tag: "vegano",
      p_new_tag: "Vegana",
    });
  });

  it("rename to a taken name is a conflict and never touches items", async () => {
    const { client, rpc } = fakeClient([
      { data: TAG, error: null },
      { data: null, error: { code: "23505", message: "dup" } },
    ]);

    await expect(
      new TagService(client).rename("acme", "t1", "sin gluten")
    ).rejects.toThrow(TagConflictError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("remove deletes the row and strips the tag from items (NULL retag)", async () => {
    const { client, rpc } = fakeClient([
      { data: { ...TAG, kind: "exercise" }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);

    expect(await new TagService(client).remove("acme", "t1")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("replace_exercise_tag", {
      p_tenant_host: "acme",
      p_old_tag: "vegano",
      p_new_tag: null,
    });
  });

  it("remove of an unknown tag is false with no side effects", async () => {
    const { client, rpc } = fakeClient([{ data: null, error: null }]);

    expect(await new TagService(client).remove("acme", "nope")).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("list coerces the RPC's bigint usage to a number", async () => {
    const { client } = fakeClient([
      {
        data: [{ id: "t1", name: "vegano", created_at: "x", usage: "3" }],
        error: null,
      },
    ]);

    expect(await new TagService(client).list("acme", "recipe")).toEqual([
      { id: "t1", name: "vegano", created_at: "x", usage: 3 },
    ]);
  });
});
