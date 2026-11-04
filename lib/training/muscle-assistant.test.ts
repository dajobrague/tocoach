import { beforeEach, describe, expect, it, vi } from "vitest";

const parse = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { parse };
  },
}));

import { AssistantUnavailableError, suggestMuscles } from "./muscle-assistant";

const bench = { key: "a", name: "Press banca plano con barra" };

beforeEach(() => {
  parse.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("suggestMuscles", () => {
  it("maps results by key and keeps primary/secondary apart", async () => {
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: {
        results: [
          {
            key: "a",
            primary: ["pectoral"],
            secondary: ["triceps", "pectoral"],
          },
          { key: "b", primary: [], secondary: [] },
        ],
      },
    });

    const out = await suggestMuscles([bench, { key: "b", name: "Burpees" }]);

    expect(out.get("a")).toEqual({
      primary: ["pectoral"],
      secondary: ["triceps"],
    });
    // No reconocido: null, nunca una sugerencia vacía.
    expect(out.get("b")).toBeNull();
  });

  it("sends the exercise data, the cached system prompt and low effort", async () => {
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { results: [] },
    });

    await suggestMuscles([
      { ...bench, legacyMuscles: ["Pecho"], equipment: ["Barra"] },
    ]);

    const request = parse.mock.calls[0]![0];

    expect(request.model).toBe("claude-haiku-5-5");
    expect(request.output_config.effort).toBe("low");
    expect(request.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(JSON.parse(request.messages[0].content).exercises[0]).toMatchObject({
      key: "a",
      equipment: ["Barra"],
      legacy_muscles: ["Pecho"],
    });
  });

  it("caps the lists at 3 primary and 4 secondary", async () => {
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: {
        results: [
          {
            key: "a",
            primary: ["dorsal"],
            secondary: [
              "trapecio",
              "biceps",
              "deltoides_posterior",
              "antebrazo",
              "triceps",
            ],
          },
        ],
      },
    });

    const out = await suggestMuscles([bench]);

    expect(out.get("a")?.secondary).toEqual([
      "trapecio",
      "biceps",
      "deltoides_posterior",
      "antebrazo",
    ]);
  });

  it("throws on refusal so the route can report it", async () => {
    parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });

    await expect(suggestMuscles([bench])).rejects.toThrow("refusal");
  });

  it("reports a missing API key as unavailable", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    await expect(suggestMuscles([bench])).rejects.toBeInstanceOf(
      AssistantUnavailableError
    );
  });
});
