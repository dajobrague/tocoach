// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { setFigureSex, useFigureSex } from "./use-figure-sex";

describe("useFigureSex", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to male, switches live and remembers the choice", () => {
    const { result } = renderHook(() => useFigureSex());

    expect(result.current).toBe("male");
    act(() => setFigureSex("female"));
    expect(result.current).toBe("female");
    expect(localStorage.getItem("topcoach:trainer:figure-sex")).toBe("female");
    act(() => setFigureSex("male"));
    expect(result.current).toBe("male");
  });
});
