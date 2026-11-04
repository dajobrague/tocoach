// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ShareComposer } from "../share-screen";

// El cuerpo sombreado se baja por red: sin él, el sticker usa el mapa plano.
vi.mock("@/lib/hooks/use-share-body", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hooks/use-share-body")>()),
  useShareBody: () => null,
}));

import {
  SAMPLE_SESSION,
  type SharePayload,
} from "@/lib/share-card/session-data";

beforeAll(() => {
  // jsdom: sin canvas, IntersectionObserver ni scrollTo.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  Element.prototype.scrollTo = () => {};
});

const data: SharePayload = {
  branding: {
    name: "Norte Coaching",
    instagram: "norte.coaching",
    brandColor: "#ff5a1f",
    logoSrc: null,
    showTopcoach: true,
  },
  session: {
    ...SAMPLE_SESSION,
    exercises: SAMPLE_SESSION.exercises.map((e, i) =>
      i === 0 ? { ...e, videoUrl: "https://cdn.example/set.mp4" } : e
    ),
  },
};

const cards = (container: HTMLElement) =>
  container.querySelectorAll("[data-index]");

describe("ShareComposer", () => {
  it("shows the session templates as a carousel", () => {
    const { container } = render(
      <ShareComposer
        data={data}
        initialExerciseId={null}
        initialScope="session"
      />
    );

    // Datos, Músculos, Anatomía, Récord, Lista, Mínimo.
    expect(cards(container)).toHaveLength(6);
    expect(container.textContent).toContain("NUEVO RÉCORD");
  });

  it("opening from an exercise preselects it and offers its set video", () => {
    const { container } = render(
      <ShareComposer
        data={data}
        initialExerciseId="bench"
        initialScope="exercise"
      />
    );

    expect(cards(container)).toHaveLength(3);
    expect(
      screen
        .getByRole("button", { name: /Press banca/ })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Tu serie" })).toBeTruthy();
  });

  it("switching exercise re-renders the exercise templates", () => {
    const { container } = render(
      <ShareComposer
        data={data}
        initialExerciseId="bench"
        initialScope="exercise"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Remo con barra/ }));
    expect(container.textContent).toContain("REMO CON BARRA");
    expect(screen.queryByRole("button", { name: "Tu serie" })).toBeNull();
  });

  it("a colour background makes the sticker draggable", () => {
    render(
      <ShareComposer
        data={data}
        initialExerciseId={null}
        initialScope="session"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Negro" }));
    expect(screen.getByRole("status").textContent).toContain("Arrastra");
  });

  it("Personalizar limits the image to three data points", async () => {
    render(
      <ShareComposer
        data={data}
        initialExerciseId={null}
        initialScope="session"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Personalizar" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("3 de 3")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /Duración/ }));
    expect(within(dialog).getByText("2 de 3")).toBeTruthy();
  });
});
