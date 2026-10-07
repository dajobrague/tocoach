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
    ).toEqual({
      ...DEFAULT_SHARE_CARD_SETTINGS,
      enabled: false,
      stats: ["volume", "reps"],
    });
  });

  it("el PUT rechaza valores desconocidos", () => {
    expect(
      validateShareCardSettings({
        enabled: true,
        style: "white",
        stats: ["sets"],
      })
    ).toEqual({
      ...DEFAULT_SHARE_CARD_SETTINGS,
      style: "white",
      stats: ["sets"],
    });
    expect(
      validateShareCardSettings({
        enabled: true,
        style: "white",
        stats: ["kcal"],
      })
    ).toBeNull();
    expect(validateShareCardSettings({ style: "panel", stats: [] })).toBeNull();
  });

  it("nombre e Instagram se sanean; un usuario inválido no se guarda", () => {
    const base = { enabled: true, style: "panel", stats: [] };

    expect(
      validateShareCardSettings({
        ...base,
        displayName: "  Coach   Joseca ",
        instagram: "@coach.joseca",
        exerciseList: false,
        showTopcoach: false,
      })
    ).toMatchObject({
      displayName: "Coach Joseca",
      instagram: "coach.joseca",
      exerciseList: false,
      showTopcoach: false,
    });
    expect(
      validateShareCardSettings({ ...base, instagram: "no vale" })
    ).toBeNull();
    // Ajustes guardados antes de existir estos campos: activados.
    expect(shareCardSettingsFromFeatures({ share_card: base })).toMatchObject({
      exerciseList: true,
      showTopcoach: true,
      instagram: "",
    });
  });
});
