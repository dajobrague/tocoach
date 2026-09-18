import { describe, expect, it } from "vitest";

import { healThemeJson } from "../heal";

const REAL =
  "https://x.supabase.co/storage/v1/object/public/trainer-logos/t/logo.png";
const BLOB =
  "blob:https://app.topcoach.io/39d5e669-5ac5-4609-9063-22c525b313ac";

describe("healThemeJson — logo URLs", () => {
  it("drops blob: previews from assets.logo, logo.url and meta.logoUrl", () => {
    const healed = healThemeJson({
      meta: { name: "Joan", logoUrl: BLOB, logoText: "Joan" },
      assets: { logo: BLOB },
      logo: { url: BLOB, text: "Joan", size: "medium" },
    });

    expect(healed.assets).toEqual({});
    expect(healed.logo).toEqual({ text: "Joan", size: "medium" });
    expect(healed.meta.logoUrl).toBeUndefined();
    expect(healed.meta.name).toBe("Joan");
  });

  it("keeps real https logos and an explicit null", () => {
    const healed = healThemeJson({
      meta: { name: "Joan", logoUrl: REAL },
      assets: { logo: REAL },
      logo: { url: null, text: "Joan" },
    });

    expect(healed.assets.logo).toBe(REAL);
    expect(healed.logo.url).toBeNull();
    expect(healed.meta.logoUrl).toBe(REAL);
  });
});
