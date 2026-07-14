import { describe, expect, it } from "vitest";

import { mealPhotoObjectPath } from "../meal-photo-service";

describe("mealPhotoObjectPath", () => {
  it("namespaces the object under the client's own id (own-path-only)", () => {
    const path = mealPhotoObjectPath(
      999000001,
      "11111111-1111-4111-8111-111111111111",
      "lunch.jpg"
    );

    expect(path).toBe("999000001/11111111-1111-4111-8111-111111111111.jpg");
    expect(path.startsWith("999000001/")).toBe(true);
  });

  it("uses a different client's id as the prefix — no cross-client path", () => {
    const a = mealPhotoObjectPath(1001, "uuid-a", "a.png");
    const b = mealPhotoObjectPath(2002, "uuid-b", "b.png");

    expect(a.startsWith("1001/")).toBe(true);
    expect(b.startsWith("2002/")).toBe(true);
    // A client's path can never contain another client's namespace.
    expect(a.includes("2002")).toBe(false);
  });

  it("defaults the extension when the filename has none", () => {
    expect(mealPhotoObjectPath(7, "uuid", "noext")).toBe("7/uuid.jpg");
  });
});
