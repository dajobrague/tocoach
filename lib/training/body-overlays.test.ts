import { describe, expect, it } from "vitest";

import {
  BODY_OVERLAYS,
  BODY_FILES,
  bestView,
  overlayRanks,
} from "./body-overlays";
import { MUSCLES } from "./muscles";

describe("body overlays", () => {
  it("covers every one of the 16 groups on at least one side", () => {
    for (const { id } of MUSCLES) {
      const v = BODY_OVERLAYS[id];

      expect((v.front?.length ?? 0) + (v.back?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it("serves the two bases once and every mapped overlay", () => {
    expect(BODY_FILES).toContain("front_base.webp");
    expect(BODY_FILES).toContain(
      "back_pectoralis_major.webp".replace(
        "back_pectoralis_major",
        "front_pectoralis_major"
      )
    );
    expect(new Set(BODY_FILES).size).toBe(BODY_FILES.length);
  });

  it("lets primary win when a shape is shared (deltoids)", () => {
    const front = overlayRanks(
      "front",
      ["deltoides_anterior"],
      ["deltoides_lateral"]
    );

    expect(front.get("front_deltoids.webp")).toBe(2);
    expect(
      overlayRanks("front", [], ["deltoides_lateral"]).get(
        "front_deltoids.webp"
      )
    ).toBe(1);
  });

  it("opens on the side with more work", () => {
    expect(bestView(["pectoral"], [])).toBe("front");
    expect(bestView(["dorsal", "gluteo"], ["isquiotibiales"])).toBe("back");
    expect(bestView([], [])).toBe("front");
  });
});
