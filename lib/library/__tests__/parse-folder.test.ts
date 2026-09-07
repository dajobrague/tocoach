import { describe, expect, it } from "vitest";

import { parseFolderId, parseFolderParam } from "../parse-folder";

const ID = "1da1abf5-c8dd-40d8-a704-aabfabf360b5";

describe("parseFolderParam", () => {
  it("maps root → null, a uuid → itself, anything else → no filter", () => {
    expect(parseFolderParam(new URLSearchParams("folder=root"))).toBeNull();
    expect(parseFolderParam(new URLSearchParams(`folder=${ID}`))).toBe(ID);
    expect(parseFolderParam(new URLSearchParams(""))).toBeUndefined();
    expect(parseFolderParam(new URLSearchParams("folder=x"))).toBeUndefined();
  });
});

describe("parseFolderId", () => {
  it("leaves the column alone when absent, moves to root on null", () => {
    expect(parseFolderId(undefined)).toBeUndefined();
    expect(parseFolderId(null)).toEqual({ ok: true, folderId: null });
    expect(parseFolderId(ID)).toEqual({ ok: true, folderId: ID });
  });

  it("rejects non-uuid values", () => {
    expect(parseFolderId("Cenas")?.ok).toBe(false);
    expect(parseFolderId(3)?.ok).toBe(false);
  });
});
