import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const MEAL_IMAGES_BUCKET = "meal-images";
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${MEAL_IMAGES_BUCKET}/`;

function mealImageStoragePathFromPublicUrl(imageUrl: string): string | null {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!base) return null;

    const u = new URL(imageUrl);
    const expectedHost = new URL(base).host;

    if (u.host !== expectedHost) return null;

    const idx = u.pathname.indexOf(PUBLIC_PATH_MARKER);

    if (idx === -1) return null;

    const path = u.pathname.slice(idx + PUBLIC_PATH_MARKER.length);

    if (!path) return null;

    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

function extensionForMime(mime: string, fileName: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };

  if (map[mime]) return map[mime];

  const fromName = fileName.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/i.test(fromName) && fromName.length <= 5) {
    return fromName;
  }

  return "jpg";
}

async function verifyOptionTrainerOwnership(
  supabase: ReturnType<typeof createSupabaseClient>,
  optionId: string,
  trainerId: string
): Promise<
  | {
      ok: true;
      option: { id: string; meal_id: string; image_url: string | null };
    }
  | { ok: false; status: number; error: string }
> {
  const { data: option, error: optError } = await supabase
    .from("nutrition_meal_options")
    .select("id, meal_id, image_url")
    .eq("id", optionId)
    .single();

  if (optError || !option) {
    return { ok: false, status: 404, error: "Opción no encontrada" };
  }

  const { data: meal, error: mealError } = await supabase
    .from("nutrition_meals")
    .select("nutrition_day_id")
    .eq("id", option.meal_id)
    .single();

  if (mealError || !meal) {
    return { ok: false, status: 404, error: "Comida no encontrada" };
  }

  const { data: day, error: dayError } = await supabase
    .from("nutrition_days")
    .select("nutrition_plan_id")
    .eq("id", meal.nutrition_day_id)
    .single();

  if (dayError || !day) {
    return { ok: false, status: 404, error: "Día no encontrado" };
  }

  const { data: plan, error: planError } = await supabase
    .from("nutrition_plans")
    .select("id")
    .eq("id", day.nutrition_plan_id)
    .eq("trainer_id", trainerId)
    .single();

  if (planError || !plan) {
    return { ok: false, status: 403, error: "No autorizado" };
  }

  return { ok: true, option };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { optionId } = await params;

    const ownership = await verifyOptionTrainerOwnership(
      supabase,
      optionId,
      session.trainer_id
    );

    if (!ownership.ok) {
      return NextResponse.json(
        { success: false, error: ownership.error },
        { status: ownership.status }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No se proporcionó ningún archivo" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Formato no válido. Usa PNG, JPG, WebP o HEIC.",
        },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: "La imagen no puede superar 5MB",
        },
        { status: 400 }
      );
    }

    const ext = extensionForMime(file.type, file.name);
    const timestamp = Date.now();
    const randomId = randomUUID().replace(/-/g, "");
    const storagePath = `${session.trainer_id}/options/${optionId}/${timestamp}-${randomId}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(MEAL_IMAGES_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Option Image] Upload error:", uploadError);

      return NextResponse.json(
        { success: false, error: "Error al subir la imagen" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(MEAL_IMAGES_BUCKET).getPublicUrl(storagePath);

    const { error: updateError } = await supabase
      .from("nutrition_meal_options")
      .update({ image_url: publicUrl })
      .eq("id", optionId);

    if (updateError) {
      console.error("[Option Image] DB update error:", updateError);

      return NextResponse.json(
        { success: false, error: "Error al guardar la imagen" },
        { status: 500 }
      );
    }

    const previousUrl = ownership.option.image_url;

    if (previousUrl) {
      const oldPath = mealImageStoragePathFromPublicUrl(previousUrl);

      if (oldPath) {
        const { error: removeError } = await supabase.storage
          .from(MEAL_IMAGES_BUCKET)
          .remove([oldPath]);

        if (removeError) {
          console.error(
            "[Option Image] Failed to remove previous object:",
            removeError
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
    });
  } catch (error) {
    console.error("[Option Image] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { optionId } = await params;

    const ownership = await verifyOptionTrainerOwnership(
      supabase,
      optionId,
      session.trainer_id
    );

    if (!ownership.ok) {
      return NextResponse.json(
        { success: false, error: ownership.error },
        { status: ownership.status }
      );
    }

    const imageUrl = ownership.option.image_url;

    if (!imageUrl) {
      return NextResponse.json({ success: true });
    }

    const path = mealImageStoragePathFromPublicUrl(imageUrl);

    if (path) {
      const { error: removeError } = await supabase.storage
        .from(MEAL_IMAGES_BUCKET)
        .remove([path]);

      if (removeError) {
        console.error("[Option Image] Storage remove error:", removeError);
      }
    }

    const { error: updateError } = await supabase
      .from("nutrition_meal_options")
      .update({ image_url: null })
      .eq("id", optionId);

    if (updateError) {
      console.error("[Option Image] DB clear image_url error:", updateError);

      return NextResponse.json(
        { success: false, error: "Error al eliminar la imagen" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Option Image] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
