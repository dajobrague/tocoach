import { NextRequest, NextResponse } from "next/server";

import {
  isLibraryTagKind,
  TagConflictError,
  TagService,
  TagValidationError,
} from "./tag-service";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

interface RouteContext {
  params: Promise<{ tagId: string }>;
}

function fail(status: number, error: string): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

function mapError(error: unknown, op: string): NextResponse {
  if (error instanceof TagValidationError) return fail(400, error.message);
  if (error instanceof TagConflictError) return fail(409, error.message);
  console.error(`[LibraryTags] ${op} error:`, error);

  return fail(500, "Internal server error");
}

async function guard(): Promise<
  { ok: true; tenantHost: string } | { ok: false; response: NextResponse }
> {
  const session = await getTrainerSession();

  if (session === null)
    return { ok: false, response: fail(401, "No autorizado") };

  return { ok: true, tenantHost: session.tenant_host };
}

const service = () => new TagService(createSupabaseClient());

// GET /api/library-tags?kind=recipe|exercise|program — the tenant's registry
// for one library, with usage counts.
export async function GET(request: NextRequest) {
  const auth = await guard();

  if (auth.ok === false) return auth.response;

  const kind = new URL(request.url).searchParams.get("kind");

  if (isLibraryTagKind(kind) === false) return fail(400, "kind inválido");

  try {
    const tags = await service().list(auth.tenantHost, kind);

    return NextResponse.json({ success: true, data: tags });
  } catch (error) {
    return mapError(error, "list");
  }
}

// POST /api/library-tags { kind, name } — create (201) or return the
// existing tag of that name (200).
export async function POST(request: NextRequest) {
  const auth = await guard();

  if (auth.ok === false) return auth.response;

  const body = await request.json().catch(() => null);
  const kind = body?.kind;

  if (isLibraryTagKind(kind) === false) return fail(400, "kind inválido");

  try {
    const { tag, created } = await service().create(
      auth.tenantHost,
      kind,
      body?.name
    );

    return NextResponse.json(
      { success: true, data: tag },
      { status: created ? 201 : 200 }
    );
  } catch (error) {
    return mapError(error, "create");
  }
}

// PATCH /api/library-tags/[tagId] { name } — rename here and on every item.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await guard();

  if (auth.ok === false) return auth.response;

  try {
    const { tagId } = await context.params;
    const body = await request.json().catch(() => null);
    const tag = await service().rename(auth.tenantHost, tagId, body?.name);

    if (tag === null) return fail(404, "Etiqueta no encontrada");

    return NextResponse.json({ success: true, data: tag });
  } catch (error) {
    return mapError(error, "rename");
  }
}

// DELETE /api/library-tags/[tagId] — remove from the registry and from
// every item that carries it.
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await guard();

  if (auth.ok === false) return auth.response;

  try {
    const { tagId } = await context.params;
    const removed = await service().remove(auth.tenantHost, tagId);

    if (removed === false) return fail(404, "Etiqueta no encontrada");

    return NextResponse.json({ success: true });
  } catch (error) {
    return mapError(error, "remove");
  }
}
