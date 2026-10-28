// @vitest-environment jsdom
import type { MuscleSelection } from "@/lib/training/muscles";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { MusclePicker } from "../muscle-picker";

function Harness(props: {
  category?: string;
  legacy?: string[];
  showError?: boolean;
}) {
  const [value, setValue] = useState<MuscleSelection>({
    primary: [],
    secondary: [],
  });

  return (
    <QueryClientProvider client={new QueryClient()}>
      <MusclePicker
        category={props.category ?? "strength"}
        exerciseName="Press banca"
        legacy={props.legacy}
        showError={props.showError ?? false}
        value={value}
        onChange={setValue}
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </QueryClientProvider>
  );
}

const value = () => JSON.parse(screen.getByTestId("value").textContent!);
// Accessible name = label + state tag, e.g. "PectoralPrincipal".
const pectoral = () =>
  screen.getByRole("button", { name: /^Pectoral(Principal|Secundario)?$/ });

describe("MusclePicker", () => {
  it("a tap cycles principal → secundario → off", () => {
    render(<Harness />);

    fireEvent.click(pectoral());
    expect(value()).toEqual({ primary: ["pectoral"], secondary: [] });
    fireEvent.click(pectoral());
    expect(value()).toEqual({ primary: [], secondary: ["pectoral"] });
    fireEvent.click(pectoral());
    expect(value()).toEqual({ primary: [], secondary: [] });
  });

  it("offers the old free text as a suggestion, applied only on tap", () => {
    render(<Harness legacy={["Pectoral", "Tríceps"]} />);

    expect(value()).toEqual({ primary: [], secondary: [] });
    fireEvent.click(screen.getByRole("button", { name: "Usar sugerencia" }));
    expect(value()).toEqual({ primary: ["pectoral"], secondary: ["triceps"] });
  });

  it("asks for a primary after a failed save, except for cardio", () => {
    const { unmount } = render(<Harness showError />);

    expect(
      screen.getByText("Elige al menos un músculo principal")
    ).toBeTruthy();
    unmount();
    render(<Harness showError category="cardio" />);
    expect(
      screen.queryByText("Elige al menos un músculo principal")
    ).toBeNull();
  });
});
