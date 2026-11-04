// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MuscleMap } from "../muscle-map";

const painted = (container: HTMLElement, opacity: string) =>
  container.querySelectorAll(`path[fill-opacity="${opacity}"]`).length;

describe("MuscleMap", () => {
  it("paints primary solid and secondary light, front and back", () => {
    const { container } = render(
      <MuscleMap primary={["pectoral"]} secondary={["triceps"]} />
    );

    // Pectoral: 8 pieces (chest + serrato, merged). Tríceps: 2 front + 6 back.
    expect(painted(container, "1")).toBe(8);
    expect(painted(container, "0.38")).toBe(8);
  });

  it("toggles visible muscles on tap; deep ones are list-only", () => {
    const onToggle = vi.fn();
    const { container } = render(
      <MuscleMap primary={[]} secondary={[]} onToggle={onToggle} />
    );
    const tappable = container.querySelectorAll("path.cursor-pointer");
    const deep = container.querySelectorAll(
      "path.pointer-events-none.fill-primary"
    );

    fireEvent.click(tappable[0]!);
    expect(onToggle).toHaveBeenCalledTimes(1);
    // Romboides paths (2) are painted under trapecio, not tappable themselves.
    expect(deep.length).toBe(2);
  });
});
