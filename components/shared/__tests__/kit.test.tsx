// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CenteredState } from "../centered-state";
import { OutlineChip } from "../outline-chip";
import { SegmentedControl } from "../segmented-control";

describe("OutlineChip", () => {
  it("tone primary reproduce la receta canónica de menu-picker", () => {
    render(<OutlineChip tone="primary">Activo</OutlineChip>);
    const chip = screen.getByText("Activo");

    expect(chip.className).toContain("border-primary/50");
    expect(chip.className).toContain("text-primary");
    expect(chip.className).toContain("rounded-full");
  });

  it("tone muted usa default-300/500", () => {
    render(<OutlineChip tone="muted">Off</OutlineChip>);
    expect(screen.getByText("Off").className).toContain("border-default-300");
  });
});

describe("CenteredState", () => {
  it("renderiza icono, título y subtítulo opcional", () => {
    render(
      <CenteredState
        icon="solar:ghost-linear"
        subtitle="Sin datos"
        title="Vacío"
      />
    );
    expect(screen.getByText("Vacío")).toBeTruthy();
    expect(screen.getByText("Sin datos")).toBeTruthy();
  });
});

describe("SegmentedControl", () => {
  it("marca la opción activa con la pill bg-content1 y aria-selected", () => {
    render(
      <SegmentedControl
        ariaLabel="Período"
        options={[
          { key: "7d", label: "7 días" },
          { key: "30d", label: "30 días" },
        ]}
        value="30d"
        onChange={() => {}}
      />
    );
    const active = screen.getByRole("tab", { selected: true });

    expect(active.textContent).toBe("30 días");
    expect(active.className).toContain("bg-content1");
  });
});
