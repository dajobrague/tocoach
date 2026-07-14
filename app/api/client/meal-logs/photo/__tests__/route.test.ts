import type { ClientSession } from "@/lib/auth/client-session";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/client-session", () => ({ getClientSession: vi.fn() }));
vi.mock("@/lib/nutrition/feature-flag", () => ({
  isNutritionV2Enabled: vi.fn(),
}));
vi.mock("@/lib/tenant/loader", () => ({ loadTenantContext: vi.fn() }));
vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/nutrition/logs/meal-photo-service", () => ({
  uploadMealPhoto: vi.fn(),
}));

import { POST } from "../route";

import { getClientSession } from "@/lib/auth/client-session";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import { uploadMealPhoto } from "@/lib/nutrition/logs/meal-photo-service";
import { loadTenantContext } from "@/lib/tenant/loader";

const mockedSession = vi.mocked(getClientSession);
const mockedFlag = vi.mocked(isNutritionV2Enabled);
const mockedTenant = vi.mocked(loadTenantContext);
const mockedUpload = vi.mocked(uploadMealPhoto);

const CLIENT_SESSION: ClientSession = {
  client_id: "999000001",
  tenant_slug: "acme",
  email: "client@example.com",
  iat: 0,
  exp: 0,
};

function fileReq(file: File | null): NextRequest {
  const form = new FormData();

  if (file !== null) {
    form.set("file", file);
  }

  return new NextRequest("http://localhost/api/client/meal-logs/photo", {
    method: "POST",
    body: form,
  });
}

function imageFile(type = "image/jpeg"): File {
  return new File([new Uint8Array([1, 2, 3])], "meal.jpg", { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockResolvedValue(CLIENT_SESSION);
  mockedFlag.mockResolvedValue(true);
  mockedTenant.mockResolvedValue({
    host: "acme.tenant",
    slug: "acme",
  } as never);
  mockedUpload.mockResolvedValue(
    "http://localhost/storage/v1/object/public/meal-photos/999000001/x.jpg"
  );
});

describe("POST /api/client/meal-logs/photo — auth + own-path", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    expect((await POST(fileReq(imageFile()))).status).toBe(401);
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("rejects a trainer token (no client_id) with 401", async () => {
    mockedSession.mockResolvedValue({
      trainer_id: "trainer-1",
      tenant_host: "acme.tenant",
      email: "t@example.com",
      iat: 0,
      exp: 0,
    } as unknown as ClientSession);

    expect((await POST(fileReq(imageFile()))).status).toBe(401);
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("returns 404 when the nutrition-v2 flag is off", async () => {
    mockedFlag.mockResolvedValue(false);

    expect((await POST(fileReq(imageFile()))).status).toBe(404);
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is provided", async () => {
    expect((await POST(fileReq(null))).status).toBe(400);
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-image file", async () => {
    expect((await POST(fileReq(imageFile("video/mp4")))).status).toBe(400);
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("uploads under the authed client's own id (never request-supplied)", async () => {
    const res = await POST(fileReq(imageFile()));
    const body = await res.json();

    expect(res.status).toBe(201);
    // The only client id the route may use is the session's.
    expect(mockedUpload).toHaveBeenCalledWith(
      expect.anything(),
      999000001,
      expect.objectContaining({ contentType: "image/jpeg" })
    );
    expect(body.success).toBe(true);
    expect(body.data.url).toContain("/meal-photos/999000001/");
  });
});
