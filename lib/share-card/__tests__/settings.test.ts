import { describe, expect, it } from "vitest";

import {
  DEFAULT_SHARE_CARD_SETTINGS,
  shareCardSettingsFromFeatures,
  validateShareCardSettings,
} from "../settings";

describe("share card settings", () => {
  it("sin configurar = defaults", () => {
    expect(shareCardSettingsFromFeatures({})).toEqual(
      DEFAULT_SHARE_CARD_SETTINGS
    );
    expect(shareCardSettingsFromFeatures(null)).toEqual(
      DEFAULT_SHARE_CARD_SETTINGS
    );
  });

  it("sanea campo a campo y respeta el orden canónico de stats", () => {
    expect(
      shareCardSettingsFromFeatures({
        share_card: {
          enabled: false,
          style: "neon",
          stats: ["reps", "x", "volume"],
        },
      })
    ).toEqual({ enabled: false, style: "dark", stats: ["volume", "reps"] });
  });

  it("el PUT rechaza valores desconocidos", () => {
    expect(
      validateShareCardSettings({
        enabled: true,
        style: "light",
        stats: ["sets"],
      })
    ).toEqual({ enabled: true, style: "light", stats: ["sets"] });
    expect(
      validateShareCardSettings({
        enabled: true,
        style: "light",
        stats: ["kcal"],
      })
    ).toBeNull();
    expect(validateShareCardSettings({ style: "dark", stats: [] })).toBeNull();
  });
});
