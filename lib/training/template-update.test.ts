import { describe, expect, it } from "vitest";

import { buildTemplateUpdate } from "./template-update";

describe("buildTemplateUpdate", () => {
  it("tags-only body (folder move) touches nothing but tags", () => {
    expect(
      buildTemplateUpdate({ tags: [" Hombre ", "hombre", "full body"] })
    ).toEqual({
      ok: true,
      updates: { tags: ["Hombre", "full body"] },
    });
  });

  it("full body (detail modal) rebuilds metadata exactly as before", () => {
    const strength = buildTemplateUpdate({
      name: "Hipertrofia",
      description: "",
      type: "Hipertrofia",
      category: "strength",
      division: "Torso/Pierna",
      goal: "ignored for strength",
      sessionsPerWeek: "4",
    });

    expect(strength).toEqual({
      ok: true,
      updates: {
        name: "Hipertrofia",
        description: null,
        metadata: {
          type: "Hipertrofia",
          sessions_per_week: 4,
          category: "strength",
          division: "Torso/Pierna",
        },
      },
    });

    const cardio = buildTemplateUpdate({
      type: "HIIT",
      category: "cardio",
      goal: "Resistencia",
      sessionsPerWeek: "",
    });

    expect(cardio).toEqual({
      ok: true,
      updates: {
        metadata: {
          type: "HIIT",
          sessions_per_week: 3,
          category: "cardio",
          goal: "Resistencia",
        },
      },
    });
  });

  it("folder_id-only body (folder move) touches nothing but folder_id", () => {
    const id = "8274e9d7-811c-4749-b8a5-fdfe1a6dd306";

    expect(buildTemplateUpdate({ folder_id: id })).toEqual({
      ok: true,
      updates: { folder_id: id },
    });
    expect(buildTemplateUpdate({ folder_id: null })).toEqual({
      ok: true,
      updates: { folder_id: null },
    });
  });

  it("rejects a blank name, bad tags, bad folder ids and non-object bodies", () => {
    expect(buildTemplateUpdate({ name: "  " }).ok).toBe(false);
    expect(buildTemplateUpdate({ tags: "hombre" }).ok).toBe(false);
    expect(buildTemplateUpdate({ folder_id: "Hombre" }).ok).toBe(false);
    expect(buildTemplateUpdate(null).ok).toBe(false);
    expect(buildTemplateUpdate([]).ok).toBe(false);
  });
});
