// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EXERCISE_TEMPLATES, SESSION_TEMPLATES, Sticker } from "../sticker";

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
    | (typeof EXERCISE_TEMPLATES)[number]["id"]
) {
  return render(
    <Sticker
      shadow
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
});
