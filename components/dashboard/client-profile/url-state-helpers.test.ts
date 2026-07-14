import { describe, expect, it } from "vitest";

import {
  applyParams,
  patchWithChildrenCleared,
  readEnumParam,
  readStringParam,
} from "./url-state-helpers";

describe("applyParams", () => {
  it("sets a new key", () => {
    expect(applyParams(new URLSearchParams(""), { tab: "charts" })).toBe(
      "tab=charts"
    );
  });

  it("overwrites an existing key", () => {
    expect(
      applyParams(new URLSearchParams("tab=training"), { tab: "charts" })
    ).toBe("tab=charts");
  });

  it("removes a key when value is null", () => {
    expect(
      applyParams(new URLSearchParams("sub=workouts&tab=charts"), { sub: null })
    ).toBe("tab=charts");
  });

  it("removes a key when value is empty string", () => {
    expect(applyParams(new URLSearchParams("ex=squat"), { ex: "" })).toBe("");
  });

  it("applies multiple changes atomically", () => {
    expect(
      applyParams(new URLSearchParams("ex=squat&sub=workouts&tab=training"), {
        tab: "charts",
        sub: null,
        ex: null,
      })
    ).toBe("tab=charts");
  });

  it("emits keys in deterministic (sorted) order", () => {
    expect(
      applyParams(new URLSearchParams(""), { tab: "training", sub: "workouts" })
    ).toBe("sub=workouts&tab=training");
  });
});

describe("patchWithChildrenCleared", () => {
  it("sets the key and nulls every child the key owns", () => {
    expect(patchWithChildrenCleared("tab", "charts")).toEqual({
      tab: "charts",
      sub: null,
      m: null,
      nd: null,
      ndv: null,
      ft: null,
      fv: null,
      ex: null,
      hd: null,
      modal: null,
      modalId: null,
    });
  });

  it("returns just the key when it owns no children", () => {
    expect(patchWithChildrenCleared("ex", "squat")).toEqual({ ex: "squat" });
  });
});

describe("readEnumParam", () => {
  const allowed = ["training", "charts"] as const;

  it("returns the value when it is allowed", () => {
    expect(
      readEnumParam(
        new URLSearchParams("tab=charts"),
        "tab",
        allowed,
        "training"
      )
    ).toBe("charts");
  });

  it("falls back when the param is missing", () => {
    expect(
      readEnumParam(new URLSearchParams(""), "tab", allowed, "training")
    ).toBe("training");
  });

  it("falls back when the value is not in the allowed list", () => {
    expect(
      readEnumParam(
        new URLSearchParams("tab=garbage"),
        "tab",
        allowed,
        "training"
      )
    ).toBe("training");
  });
});

describe("readStringParam", () => {
  it("returns the raw value", () => {
    expect(readStringParam(new URLSearchParams("ex=squat"), "ex")).toBe(
      "squat"
    );
  });

  it("returns the fallback (null) when missing", () => {
    expect(readStringParam(new URLSearchParams(""), "ex")).toBeNull();
  });

  it("returns a custom fallback when missing", () => {
    expect(readStringParam(new URLSearchParams(""), "ex", "default")).toBe(
      "default"
    );
  });
});
