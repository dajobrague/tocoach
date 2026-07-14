import type { SetupWizardState } from "@/lib/setup-wizard/context";

import { describe, expect, it } from "vitest";

import { generatePreviewCSS, hexToHSL } from "./preview-css";

describe("hexToHSL", () => {
  it("converts valid 6-digit hex (with or without #)", () => {
    expect(hexToHSL("#ffffff")).toBe("0 0% 100%");
    expect(hexToHSL("#000000")).toBe("0 0% 0%");
    expect(hexToHSL("ff0000")).toBe("0 100% 50%");
  });

  it("falls back to neutral gray instead of throwing on missing/invalid input", () => {
    // The onboarding crash: a legacy/partial theme omits colors.text.h1, so the
    // value reaching hexToHSL is undefined. It must never throw.
    expect(() => hexToHSL(undefined)).not.toThrow();
    expect(hexToHSL(undefined)).toBe("0 0% 50%");
    expect(hexToHSL(null)).toBe("0 0% 50%");
    expect(hexToHSL("")).toBe("0 0% 50%");
    expect(hexToHSL("#abc")).toBe("0 0% 50%"); // 3-digit shorthand unsupported
    expect(hexToHSL("not-a-color")).toBe("0 0% 50%");
  });
});

describe("generatePreviewCSS", () => {
  it("does not throw when colors.text is a partial/legacy shape", () => {
    // Mirrors the gorkamerodo tenant: colors.text only has {primary, secondary}
    // — no h1/h2/body/muted — which used to crash the whole onboarding page
    // because the shallow `colors.text || default` mapping left those undefined.
    const state = {
      colors: {
        primary: "#0f172a",
        secondary: "#334155",
        text: { primary: "#0f172a", secondary: "#64748b" },
        background: {
          primary: "#ffffff",
          secondary: "#f9fafb",
          accent: "#f3f4f6",
        },
        surface: { "1": "#ffffff", "2": "#f8fafc" },
        semantic: { success: "#10b981", warning: "#f59e0b", danger: "#ef4444" },
        shadows: {
          light: "rgba(0,0,0,0.05)",
          medium: "rgba(0,0,0,0.1)",
          dark: "rgba(0,0,0,0.25)",
        },
      },
      fonts: { heading: { family: "Inter" }, body: { family: "Inter" } },
    } as unknown as SetupWizardState;

    expect(() => generatePreviewCSS(state)).not.toThrow();
    expect(generatePreviewCSS(state)).toContain(".preview-theme-wrapper");
  });
});
