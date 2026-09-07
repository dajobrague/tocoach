import { describe, expect, it } from "vitest";

import { metricFormat } from "../metric-format";

const fq = (question_id: string) =>
  ({ kind: "form_question", form_type: "habits", question_id }) as const;

describe("metricFormat", () => {
  it("maps known metrics to a fixed unit", () => {
    expect(metricFormat(fq("body_weight"))).toEqual({ unit: "kg" });
    expect(metricFormat(fq("calories"))).toEqual({ unit: "kcal" });
    expect(metricFormat(fq("sleep_hours"))).toEqual({ unit: "h" });
    expect(metricFormat(fq("protein"))).toEqual({ unit: "g" });
  });

  it("flags 1-5 ratings before unit heuristics", () => {
    expect(metricFormat(fq("energy_levels"))).toEqual({ rating: true });
    expect(metricFormat(fq("service_rating"))).toEqual({ rating: true });
  });

  it("returns nothing for unknown custom metrics and catalog sources", () => {
    expect(metricFormat(fq("cintura"))).toEqual({});
    expect(metricFormat({ kind: "catalog", id: "training_breakdown" })).toEqual(
      {}
    );
  });
});
