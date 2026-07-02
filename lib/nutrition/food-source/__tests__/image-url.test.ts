import { describe, expect, it } from "vitest";

import { largerImageUrl } from "../image-url";

describe("largerImageUrl", () => {
  it("upgrades an OFF small image to the 400px variant", () => {
    expect(
      largerImageUrl("https://images.openfoodfacts.org/p/front_fr.715.200.jpg")
    ).toBe("https://images.openfoodfacts.org/p/front_fr.715.400.jpg");
  });

  it("upgrades a 100px thumb to 400px", () => {
    expect(largerImageUrl("https://x/front_en.12.100.jpg")).toBe(
      "https://x/front_en.12.400.jpg"
    );
  });

  it("leaves an already-large image unchanged", () => {
    expect(largerImageUrl("https://x/front_en.12.400.jpg")).toBe(
      "https://x/front_en.12.400.jpg"
    );
  });

  it("returns the original URL when the size pattern is absent", () => {
    expect(largerImageUrl("https://x/image.png")).toBe("https://x/image.png");
  });
});
