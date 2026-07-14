import type {
  CreateMediaInput,
  RecipeMediaType,
} from "@/lib/nutrition/recipes/recipe-media-service";

import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  errorMessage,
  guardRecipeRequest,
  recipeNotFound,
} from "@/lib/nutrition/recipes/recipe-request";
import { RecipeMediaService } from "@/lib/nutrition/recipes/recipe-media-service";
import { compressVideo } from "@/lib/utils/server-video-compression";

export const runtime = "nodejs";
// Raw uploads can be large and video compression is slow on shared CPU — give
// the route headroom (ffmpeg has its own internal timeout). Mirrors the
// training-side exercise video route.
export const maxDuration = 600;

const LOG_PREFIX = "[Recipe Media API]";
const IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
];
const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
];
const MAX_SIZE = 1024 * 1024 * 1024; // 1 GB raw (matches the training video side)

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/recipes/[id]/media — list a recipe's media (for the editor).
export async function GET(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await params;
    const service = new RecipeMediaService(createSupabaseClient());
    const rows = await service.list(guard.session.tenant_host, id);

    if (rows === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error(`${LOG_PREFIX} list error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

function mediaTypeOf(mime: string): RecipeMediaType | null {
  if (IMAGE_TYPES.includes(mime)) return "image";
  if (VIDEO_TYPES.includes(mime)) return "video";

  return null;
}

// POST /api/recipes/[id]/media — upload a recipe photo or vertical video.
export async function POST(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (file === null || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "No se proporcionó archivo" },
        { status: 400 }
      );
    }

    const mediaType = mediaTypeOf(file.type);

    if (mediaType === null) {
      return NextResponse.json(
        { success: false, error: "Tipo de archivo no permitido" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "El archivo es demasiado grande (máx 1GB)" },
        { status: 400 }
      );
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    let uploadBuffer = rawBuffer;
    let contentType = file.type;
    let filename = file.name;

    if (mediaType === "video") {
      try {
        // Reuse the training-side compression pipeline (libx264 CRF 23, 1080p).
        const compressed = await compressVideo({
          buffer: rawBuffer,
          filename: file.name,
        });

        uploadBuffer = compressed.buffer;
        contentType = compressed.contentType;
        filename = compressed.filename;
      } catch (err) {
        // Fall back to the raw upload so the trainer never loses their video.
        console.error(`${LOG_PREFIX} compression failed, uploading raw:`, {
          correlationId: guard.correlationId,
          error: errorMessage(err),
        });
      }
    }

    const input: CreateMediaInput = {
      mediaType,
      buffer: uploadBuffer,
      contentType,
      filename,
    };
    const rawOrientation = formData.get("orientation");

    if (rawOrientation === "vertical" || rawOrientation === "horizontal") {
      input.orientation = rawOrientation;
    }

    const rawSort = formData.get("sort_order");

    if (typeof rawSort === "string" && Number.isFinite(Number(rawSort))) {
      input.sortOrder = Number(rawSort);
    }

    const service = new RecipeMediaService(createSupabaseClient());
    const row = await service.create(guard.session.tenant_host, id, input);

    if (row === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    console.error(`${LOG_PREFIX} upload error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// DELETE /api/recipes/[id]/media?mediaId= — remove a media object + row.
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("mediaId");

    if (mediaId === null || mediaId.length === 0) {
      return NextResponse.json(
        { success: false, error: "Falta mediaId" },
        { status: 400 }
      );
    }

    const service = new RecipeMediaService(createSupabaseClient());
    const removed = await service.remove(
      guard.session.tenant_host,
      id,
      mediaId
    );

    if (removed === null) {
      return recipeNotFound();
    }

    return NextResponse.json({ success: true, data: removed });
  } catch (error) {
    console.error(`${LOG_PREFIX} delete error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
