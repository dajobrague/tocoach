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

  it("ajustes antiguos (estilo, datos, lista) se leen sin romper", () => {
    expect(
      shareCardSettingsFromFeatures({
        share_card: {
          enabled: false,
          style: "panel",
          stats: ["volume"],
          exerciseList: true,
          instagram: "coach.joseca",
        },
      })
    ).toEqual({
      ...DEFAULT_SHARE_CARD_SETTINGS,
      enabled: false,
      instagram: "coach.joseca",
    });
  });

  it("el PUT exige enabled y sanea nombre e Instagram", () => {
    expect(
      validateShareCardSettings({
        enabled: true,
        displayName: "  Coach   Joseca ",
        instagram: "@coach.joseca",
        showTopcoach: false,
      })
    ).toEqual({
      enabled: true,
      displayName: "Coach Joseca",
      instagram: "coach.joseca",
      showTopcoach: false,
    });
    expect(validateShareCardSettings({ displayName: "x" })).toBeNull();
    expect(
      validateShareCardSettings({ enabled: true, instagram: "no vale" })
    ).toBeNull();
  });
});
