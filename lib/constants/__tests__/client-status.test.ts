import { describe, expect, it } from "vitest";

import { CLIENT_STATUS_OPTIONS, isClientStatusOption } from "../client-status";

import { Constants } from "@/types/supabase";

const DB_STATUSES: readonly string[] = Constants.public.Enums.client_status;

describe("client-status", () => {
  it("solo ofrece estados que existen en el enum de la BD", () => {
    for (const status of CLIENT_STATUS_OPTIONS) {
      expect(DB_STATUSES).toContain(status);
    }
  });

  it("rechaza los estados heredados que ya no se ofrecen", () => {
    expect(isClientStatusOption("Activo")).toBe(true);
    expect(isClientStatusOption("Inactivo")).toBe(true);
    expect(isClientStatusOption("Onboarding Completado")).toBe(false);
    expect(isClientStatusOption(undefined)).toBe(false);
  });
});
