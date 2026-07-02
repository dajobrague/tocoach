import { describe, expect, it } from "vitest";

import { pickThumbnailUrl } from "../recipe-service";

describe("pickThumbnailUrl", () => {
  it("returns the image with the lowest sort_order", () => {
    const url = pickThumbnailUrl([
      { type: "image", url: "second.jpg", sort_order: 2 },
      { type: "image", url: "first.jpg", sort_order: 1 },
    ]);

    expect(url).toBe("first.jpg");
  });

  it("ignores videos", () => {
    const url = pickThumbnailUrl([
      { type: "video", url: "clip.mp4", sort_order: 0 },
      { type: "image", url: "photo.jpg", sort_order: 1 },
    ]);

    expect(url).toBe("photo.jpg");
  });

  it("returns null when there are no images", () => {
    expect(
      pickThumbnailUrl([{ type: "video", url: "clip.mp4", sort_order: 0 }])
    ).toBeNull();
  });

  it("returns null for empty or non-array input", () => {
    expect(pickThumbnailUrl([])).toBeNull();
    expect(pickThumbnailUrl(undefined)).toBeNull();
    expect(pickThumbnailUrl(null)).toBeNull();
  });
});
