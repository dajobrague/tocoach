import type { TrainerSession } from "@/lib/auth/session";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, removeMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getTrainerSession: vi.fn() }));
vi.mock("@/lib/nutrition/feature-flag", () => ({
  isNutritionV2Enabled: vi.fn(),
}));
vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/utils/server-video-compression", () => ({
  compressVideo: vi.fn(),
}));
vi.mock("@/lib/nutrition/recipes/recipe-media-service", () => ({
  RecipeMediaService: vi.fn(function RecipeMediaServiceStub() {
    return { create: createMock, remove: removeMock };
  }),
}));

import { DELETE as mediaDELETE, POST as mediaPOST } from "../route";

import { getTrainerSession } from "@/lib/auth/session";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";

const mockedSession = vi.mocked(getTrainerSession);
const mockedFlag = vi.mocked(isNutritionV2Enabled);

const SESSION: TrainerSession = {
  trainer_id: "trainer-1",
  tenant_host: "acme.tenant",
  email: "trainer@example.com",
  iat: 0,
  exp: 0,
};

const mediaRow = {
  id: "m1",
  recipe_id: "r1",
  type: "image",
  url: "http://localhost/storage/v1/object/public/recipe-media/p.jpg",
};

function imageFile(): File {
  return new File([new Uint8Array([1, 2, 3])], "photo.jpg", {
    type: "image/jpeg",
  });
}

function postArgs(form: FormData) {
  return [
    new NextRequest("http://localhost/api/recipes/r1/media", {
      method: "POST",
      body: form,
    }),
    { params: Promise.resolve({ id: "r1" }) },
  ] as const;
}

function deleteArgs(qs: string) {
  return [
    new NextRequest(`http://localhost/api/recipes/r1/media${qs}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: "r1" }) },
  ] as const;
}

function formWith(file?: File): FormData {
  const fd = new FormData();

  if (file !== undefined) {
    fd.set("file", file);
  }

  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockResolvedValue(SESSION);
  mockedFlag.mockResolvedValue(true);
});

describe("POST /api/recipes/[id]/media", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    const res = await mediaPOST(...postArgs(formWith(imageFile())));

    expect(res.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the flag is off", async () => {
    mockedFlag.mockResolvedValue(false);

    const res = await mediaPOST(...postArgs(formWith(imageFile())));

    expect(res.status).toBe(404);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is provided", async () => {
    const res = await mediaPOST(...postArgs(formWith()));

    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the recipe belongs to another tenant", async () => {
    createMock.mockResolvedValue(null);

    const res = await mediaPOST(...postArgs(formWith(imageFile())));

    expect(res.status).toBe(404);
  });

  it("returns 201 and inserts a media row of type image", async () => {
    createMock.mockResolvedValue(mediaRow);

    const res = await mediaPOST(...postArgs(formWith(imageFile())));

    expect(res.status).toBe(201);

    const body = await res.json();

    expect(body).toEqual({ success: true, data: mediaRow });
    expect(createMock).toHaveBeenCalledWith(
      "acme.tenant",
      "r1",
      expect.objectContaining({ mediaType: "image", contentType: "image/jpeg" })
    );
  });
});

describe("DELETE /api/recipes/[id]/media", () => {
  it("returns 400 when mediaId is missing", async () => {
    const res = await mediaDELETE(...deleteArgs(""));

    expect(res.status).toBe(400);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("removes the row and returns 200", async () => {
    removeMock.mockResolvedValue(mediaRow);

    const res = await mediaDELETE(...deleteArgs("?mediaId=m1"));

    expect(res.status).toBe(200);
    expect(removeMock).toHaveBeenCalledWith("acme.tenant", "r1", "m1");
  });

  it("returns 404 when the media/recipe is not found", async () => {
    removeMock.mockResolvedValue(null);

    const res = await mediaDELETE(...deleteArgs("?mediaId=missing"));

    expect(res.status).toBe(404);
  });
});
