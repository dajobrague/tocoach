// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  EXERCISE_TEMPLATES,
  SESSION_TEMPLATES,
  Sticker,
  type StickerProps,
} from "../sticker";

import { anatomyCrop } from "@/lib/share-card/anatomy-crops";
import { BODY_HEIGHT, BODY_WIDTH } from "@/lib/training/body-overlays";
import { muscleVolume } from "@/lib/training/muscle-volume";
import { MUSCLES, muscleLabel } from "@/lib/training/muscles";
import {
  SAMPLE_SESSION,
  SESSION_STATS,
  type ShareBranding,
  pickStats,
} from "@/lib/share-card/session-data";

// jsdom no implementa canvas: textWidth cae a su estimación.
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

const branding: ShareBranding = {
  name: "Norte Coaching",
  instagram: "norte.coaching",
  brandColor: "#ff5a1f",
  logoSrc: null,
  showTopcoach: true,
};
const stats = pickStats(SESSION_STATS, ["volume", "sets"], SAMPLE_SESSION);
const bench = SAMPLE_SESSION.exercises[0]!;

function renderTemplate(
  template:
    | (typeof SESSION_TEMPLATES)[number]["id"]
    | (typeof EXERCISE_TEMPLATES)[number]["id"],
  body: StickerProps["body"] = null
) {
  return render(
    <Sticker
      shadow
      body={body}
      branding={branding}
      exercise={template.startsWith("ex-") ? bench : null}
      id="t"
      ink="white"
      mapMode="auto"
      session={SAMPLE_SESSION}
      stats={stats}
      template={template}
      onBrandBg={false}
    />
  ).container;
}

describe("Sticker", () => {
  it.each([...SESSION_TEMPLATES, ...EXERCISE_TEMPLATES].map((t) => t.id))(
    "%s renders the trainer's signature",
    (template) => {
      const text = renderTemplate(template).textContent ?? "";

      expect(text).toContain("NORTE COACHING");
      expect(text).toContain("@norte.coaching");
      expect(text).toContain("topcoach.io");
    }
  );

  it("record template leads with the record set", () => {
    const text = renderTemplate("record").textContent ?? "";

    expect(text).toContain("NUEVO RÉCORD");
    expect(text).toContain("Press banca");
  });

  it("muscle template paints the worked muscles in the brand color", () => {
    const container = renderTemplate("musculos");

    expect(
      container.querySelectorAll('path[fill="#ff5a1f"]').length
    ).toBeGreaterThan(0);
  });

  it("muscle template lists groups with their series", () => {
    const text = renderTemplate("musculos").textContent ?? "";

    expect(text).toMatch(/· \d+(,\d)? series?/);
  });

  it("series template marks the record set", () => {
    const text = renderTemplate("ex-series").textContent ?? "";

    expect(text).toContain("Serie 4");
    expect(text).toContain("100 kg × 3");
  });

  describe("anatomy template", () => {
    const worked = muscleVolume(
      SAMPLE_SESSION.exercises.map((e) => ({
        sets: e.sets.length,
        primary: e.primary,
        secondary: e.secondary,
      }))
    ).slice(0, 6);
    const files = Object.fromEntries(
      [
        "front_base.webp",
        "back_base.webp",
        "front_pectoralis_major.webp",
        "back_latissimus_dorsi.webp",
      ].map((f) => [f, `data:image/webp;base64,${f}`])
    );

    it.each([
      ["with the shaded body", { sex: "female" as const, files }],
      ["without body (flat fallback)", null],
    ])("draws one tile per worked group %s", (_, body) => {
      const container = renderTemplate("anatomia", body);
      const tiles = container.querySelectorAll("[data-muscle]");

      expect(tiles).toHaveLength(worked.length);
      worked.forEach(({ id, sets }, i) => {
        const tile = tiles[i]!;

        expect(tile.getAttribute("data-muscle")).toBe(id);
        expect(tile.textContent).toContain(muscleLabel(id));
        expect(tile.textContent).toContain(
          `${String(sets).replace(".", ",")} serie`
        );
      });
    });

    it("lights only the tile's own overlays on the shaded body", () => {
      const container = renderTemplate("anatomia", { sex: "male", files });
      const pecho = container.querySelector('[data-muscle="pectoral"]')!;
      const hrefs = [...pecho.querySelectorAll("image")].map((img) =>
        img.getAttribute("href")
      );

      expect(hrefs).toEqual([
        files["front_base.webp"],
        files["front_pectoralis_major.webp"],
      ]);
    });

    it("crops a square inside the figure around every group", () => {
      for (const sex of ["male", "female"] as const) {
        for (const { id } of MUSCLES) {
          const c = anatomyCrop(sex, id);

          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.x + c.side).toBeLessThanOrEqual(BODY_WIDTH);
          expect(c.y + c.side).toBeLessThanOrEqual(BODY_HEIGHT[sex][c.view]);
        }
      }
    });
  });
});
