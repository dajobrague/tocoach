import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  FormResponseSubmission,
  getEnabledQuestions,
  isStructuredConfig,
  normalizeFormAnswers,
  validateFormResponse,
} from "@/lib/forms";
import { relaxStepsRequirement } from "@/lib/forms/neat-steps";

/**
 * GET /api/forms/responses/[clientId]?form_type=checkins|habits&start_date=&end_date=
 * Get form responses for a specific client
 * Supports both trainer and client sessions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    // Check for either trainer or client session
    const trainerSession = await getTrainerSession();
    const clientSession = await getClientSession();

    if (!trainerSession && !clientSession) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId: clientIdStr } = await params;
    const clientId = parseInt(clientIdStr);

    if (isNaN(clientId)) {
      return NextResponse.json(
        { success: false, error: "ID de cliente inválido" },
        { status: 400 }
      );
    }

    // Get tenant_host for this client
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("host, trainer_id")
      .eq("trainer_id", clientData.tenant)
      .single();

    if (tenantError || !tenantData) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantHost = tenantData.host;

    // Authorization check
    if (trainerSession) {
      if (tenantData.trainer_id !== trainerSession.trainer_id) {
        return NextResponse.json(
          { success: false, error: "No autorizado para este cliente" },
          { status: 403 }
        );
      }
    } else if (clientSession) {
      // Clients can only access their own data
      if (String(clientSession.client_id) !== String(clientId)) {
        return NextResponse.json(
          { success: false, error: "No autorizado" },
          { status: 403 }
        );
      }
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const formType = searchParams.get("form_type");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    if (!formType || (formType !== "checkins" && formType !== "habits")) {
      return NextResponse.json(
        { success: false, error: "Tipo de formulario inválido" },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from("form_responses")
      .select("*")
      .eq("client_id", clientId)
      .eq("form_type", formType)
      .eq("tenant_host", tenantHost);

    // Apply date filters
    if (startDate) {
      query = query.gte("response_date", startDate);
    }
    if (endDate) {
      query = query.lte("response_date", endDate);
    }

    const { data: responses, error } = await query.order("response_date", {
      ascending: false,
    });

    if (error) {
      console.error("[Forms Responses] Error fetching responses:", error);

      return NextResponse.json(
        { success: false, error: "Error al obtener respuestas" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      responses: (responses || []).map((row) => ({
        ...row,
        answers: normalizeFormAnswers(row.answers),
      })),
    });
  } catch (error) {
    console.error("[Forms Responses] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms/responses/[clientId]
 * Submit a new form response
 * Supports both trainer and client sessions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    // Check for either trainer or client session
    const trainerSession = await getTrainerSession();
    const clientSession = await getClientSession();

    if (!trainerSession && !clientSession) {
      // Log auth failures so we can distinguish the real-world causes:
      //   - cookie blocked/dropped (Safari ITP, iframe, in-app browser)
      //   - JWT expired (> 30 days since last login)
      //   - neither transport presented
      // The user-agent helps identify in-app browsers (IG/FB/TikTok).
      const ua = request.headers.get("user-agent") || "unknown";
      const hasCookie = Boolean(request.headers.get("cookie"));
      const hasAuth = Boolean(request.headers.get("authorization"));
      const { clientId: dbgClientId } = await params;

      console.warn("[Forms POST] Unauthorized submission attempt", {
        clientIdFromUrl: dbgClientId,
        userAgent: ua,
        hasCookieHeader: hasCookie,
        hasAuthHeader: hasAuth,
      });

      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId: clientIdStr } = await params;
    const clientId = parseInt(clientIdStr);

    if (isNaN(clientId)) {
      return NextResponse.json(
        { success: false, error: "ID de cliente inválido" },
        { status: 400 }
      );
    }

    // Get tenant_host for this client
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("host, trainer_id")
      .eq("trainer_id", clientData.tenant)
      .single();

    if (tenantError || !tenantData) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantHost = tenantData.host;

    // Authorization check
    if (trainerSession) {
      if (tenantData.trainer_id !== trainerSession.trainer_id) {
        return NextResponse.json(
          { success: false, error: "No autorizado para este cliente" },
          { status: 403 }
        );
      }
    } else if (clientSession) {
      // Clients can only submit their own responses
      if (String(clientSession.client_id) !== String(clientId)) {
        return NextResponse.json(
          { success: false, error: "No autorizado" },
          { status: 403 }
        );
      }
    }

    const body: FormResponseSubmission = await request.json();
    const { form_type, response_date, answers, metadata } = body;

    // Single source-of-truth para la fecha del registro. El cliente
    // (browser) siempre envía `response_date` calculado en huso local
    // (ver `getLocalTodayYmd` en lib/forms/client-helpers.ts); este
    // fallback UTC se usa solo si un caller no-browser (tests, scripts)
    // omite el campo. Lo computamos UNA vez aquí y lo reusamos en la
    // validación de window y en el upsert — antes había dos cómputos
    // separados y un drift teórico cerca de medianoche si
    // `response_date` venía como "" en lugar de undefined.
    const resolvedDate =
      response_date || new Date().toISOString().split("T")[0]!;

    // Habits sólo se pueden enviar para los últimos 3 días (hoy, ayer,
    // antier en el calendario del cliente). Comparamos en espacio
    // YMD puro contra "hoy UTC" del servidor con tolerancia ±2 días
    // por cada lado (rango efectivo [-2, 4]). Antes era [-1, 3] pero
    // clientes en husos extremos (UTC-12 / UTC+14) podían tener su
    // "antier" local cayendo fuera de esa ventana cuando el clock
    // del server cruzaba medianoche UTC en otro momento del día. La
    // ampliación a 2 días cubre cualquier huso poblado y mantiene la
    // semántica de "últimos 3 días" — un atacante no gana nada
    // significativo con este margen.
    if (form_type === "habits") {
      const todayUtcStr = new Date().toISOString().split("T")[0]!;
      const targetMs = Date.parse(`${resolvedDate}T00:00:00Z`);
      const todayMs = Date.parse(`${todayUtcStr}T00:00:00Z`);

      if (Number.isNaN(targetMs)) {
        return NextResponse.json(
          { success: false, error: "Fecha inválida" },
          { status: 400 }
        );
      }

      const diffDays = Math.round((todayMs - targetMs) / 86400000);

      if (diffDays < -2 || diffDays > 4) {
        return NextResponse.json(
          {
            success: false,
            error: "Solo puedes enviar registros de los últimos 3 días",
          },
          { status: 400 }
        );
      }
    }

    // Validate required fields
    if (!form_type || (form_type !== "checkins" && form_type !== "habits")) {
      return NextResponse.json(
        { success: false, error: "Tipo de formulario inválido" },
        { status: 400 }
      );
    }

    if (
      !answers ||
      typeof answers !== "object" ||
      Array.isArray(answers) ||
      answers === null
    ) {
      return NextResponse.json(
        { success: false, error: "Respuestas requeridas" },
        { status: 400 }
      );
    }

    let { data: configRow, error: configFetchError } = await supabase
      .from("client_form_configs")
      .select("questions_config")
      .eq("client_id", clientId)
      .eq("form_type", form_type)
      .maybeSingle();

    if (configFetchError) {
      console.error(
        "[Forms Responses] Error loading form config:",
        configFetchError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Error al cargar la configuración del formulario",
        },
        { status: 500 }
      );
    }

    // Si el cliente no tiene una row en `client_form_configs`,
    // intentamos crearla desde el template del entrenador via la RPC
    // `get_or_create_client_form_config` (definida en migration 020).
    // Antes esto fallaba con 400 "El formulario no está configurado",
    // mensaje técnico que el cliente no entendía cuando el entrenador
    // recién había creado al cliente sin haber guardado el editor de
    // formularios. La RPC también es idempotente, así que llamar
    // dos veces no duplica.
    if (!configRow?.questions_config) {
      const { data: createdRows, error: rpcError } = await supabase.rpc(
        "get_or_create_client_form_config",
        {
          p_client_id: clientId,
          p_form_type: form_type,
          p_tenant_host: tenantHost,
        }
      );

      if (rpcError) {
        console.error(
          "[Forms Responses] get_or_create_client_form_config failed:",
          rpcError
        );
      }

      const createdRow = Array.isArray(createdRows) ? createdRows[0] : null;

      if (createdRow?.questions_config) {
        configRow = { questions_config: createdRow.questions_config };
      } else {
        return NextResponse.json(
          {
            success: false,
            error:
              "El formulario aún no está disponible. Pídele a tu entrenador que lo configure.",
          },
          { status: 400 }
        );
      }
    }

    const questionsConfig = configRow.questions_config;
    const questionsArray = isStructuredConfig(questionsConfig)
      ? questionsConfig.questions
      : Array.isArray(questionsConfig)
        ? questionsConfig
        : [];

    const enabledQuestions = getEnabledQuestions(questionsArray);

    // Build the set of valid question IDs from the current config so we can
    // strip any stale keys that were saved under a previous form version.
    // Without this, renaming or removing a question causes "unexpected field"
    // validation errors for clients who have answers under the old key.
    const validQuestionIds = new Set<string>();

    enabledQuestions.forEach((q) => {
      validQuestionIds.add(q.id);
      q.subQuestions?.forEach((sq) => validQuestionIds.add(sq.id));
    });

    const cleanedAnswers = Object.fromEntries(
      Object.entries(answers as Record<string, unknown>).filter(([k]) =>
        validQuestionIds.has(k)
      )
    );

    if (
      enabledQuestions.length > 0 &&
      Object.keys(cleanedAnswers).length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Debes enviar al menos una respuesta.",
        },
        { status: 400 }
      );
    }

    // El cliente OCULTA la pregunta de pasos cuando no hay NEAT cards (ver
    // `visibleQuestions` en dynamic-form-modal.tsx), así que aquí no podemos
    // exigirla: el cliente nunca pudo contestarla. Sin esta paridad, un
    // "pasos" required + 0 NEAT cards bloqueaba el envío para siempre con un
    // error sobre un campo invisible. Si la query falla, fail-open (se
    // mantiene el required) — mismo criterio que el cliente.
    let effectiveQuestionsArray = questionsArray;

    if (form_type === "habits") {
      const { count: neatCount, error: neatError } = await supabase
        .from("client_neat_cards")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId);

      if (!neatError && (neatCount ?? 0) === 0) {
        effectiveQuestionsArray = relaxStepsRequirement(questionsArray);
      }
    }

    const validation = validateFormResponse(
      { ...body, answers: cleanedAnswers },
      isStructuredConfig(questionsConfig)
        ? { ...questionsConfig, questions: effectiveQuestionsArray }
        : effectiveQuestionsArray
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Respuestas inválidas",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // `resolvedDate` ya fue computado al inicio del handler (single
    // source of truth — ver comentario arriba).

    // Preserve historical answers for questions that were renamed or disabled
    // after this day's response was first submitted. Without this merge, a
    // client re-editing an old record would wipe keys no longer present in
    // the current config. We only merge keys NOT in validQuestionIds — the
    // current-config keys are fully overwritten by the new submission.
    const { data: existingRow } = await supabase
      .from("form_responses")
      .select("answers")
      .eq("tenant_host", tenantHost)
      .eq("client_id", clientId)
      .eq("form_type", form_type)
      .eq("response_date", resolvedDate)
      .maybeSingle();

    const existingAnswers = existingRow
      ? normalizeFormAnswers(existingRow.answers)
      : {};
    const preservedOrphanAnswers = Object.fromEntries(
      Object.entries(existingAnswers).filter(([k]) => !validQuestionIds.has(k))
    );
    const mergedAnswers = { ...preservedOrphanAnswers, ...cleanedAnswers };

    // Upsert response (insert or update if same day already exists)
    const { data: response, error } = await supabase
      .from("form_responses")
      .upsert(
        {
          tenant_host: tenantHost,
          client_id: clientId,
          form_type,
          response_date: resolvedDate,
          answers: mergedAnswers,
          metadata: metadata || {},
        },
        {
          onConflict: "tenant_host,client_id,form_type,response_date",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("[Forms Responses] Error creating response:", error);

      return NextResponse.json(
        { success: false, error: "Error al crear respuesta" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("[Forms Responses] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
