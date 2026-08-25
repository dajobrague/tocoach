import type { BucketedPoint } from "@/lib/charts/types";

import { describe, expect, it } from "vitest";

import { headerStatValue, parseHeaderStatMode } from "../header-stat";

const buckets = (values: Array<number | null>): BucketedPoint[] =>
  values.map((value, i) => ({ label: `d${i}`, value }));

describe("headerStatValue", () => {
  it("returns the latest non-null value in latest mode", () => {
    expect(headerStatValue(buckets([70, 72, null, 74, null]), "latest")).toBe(
      74
    );
  });

  it("returns the mean of non-null values in average mode", () => {
    expect(headerStatValue(buckets([70, null, 74]), "average")).toBe(72);
  });

  it("returns null for both modes when every bucket is null", () => {
    expect(headerStatValue(buckets([null, null]), "latest")).toBeNull();
    expect(headerStatValue(buckets([null, null]), "average")).toBeNull();
  });

  it("treats a legitimate 0 as a value, not absence", () => {
    expect(headerStatValue(buckets([4, 0]), "latest")).toBe(0);
    expect(headerStatValue(buckets([4, 0]), "average")).toBe(2);
  });
});

describe("parseHeaderStatMode", () => {
  it("passes through valid modes", () => {
    expect(parseHeaderStatMode("latest")).toBe("latest");
    expect(parseHeaderStatMode("average")).toBe("average");
  });

  it("falls back to latest on null or garbage", () => {
    expect(parseHeaderStatMode(null)).toBe("latest");
    expect(parseHeaderStatMode("banana")).toBe("latest");
  });
});
