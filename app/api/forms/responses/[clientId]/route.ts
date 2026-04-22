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

    // Habits can only be submitted for the last 3 days (today, yesterday, day before)
    if (form_type === "habits" && response_date) {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0]!;
      const target = new Date(response_date + "T12:00:00Z");
      const todayDate = new Date(todayStr + "T12:00:00Z");
      const diffDays = Math.round(
        (todayDate.getTime() - target.getTime()) / 86400000
      );

      if (diffDays < 0 || diffDays > 2) {
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

    const { data: configRow, error: configFetchError } = await supabase
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

    if (!configRow?.questions_config) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El formulario no está configurado para este cliente. El entrenador debe guardar la configuración antes de poder enviar respuestas.",
        },
        { status: 400 }
      );
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

    const validation = validateFormResponse(
      { ...body, answers: cleanedAnswers },
      questionsConfig
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

    // El cliente (browser) siempre envía `response_date` calculado en huso
    // local (ver `getLocalTodayYmd` en `lib/forms/client-helpers.ts`), así
    // que esta rama UTC sólo se ejecuta si un llamador no-browser (tests,
    // scripts) omite el campo. Para esos casos dejamos UTC como fallback
    // defensivo — documentado para evitar que alguien "arregle" esto al
    // huso del servidor sin entender las implicaciones.
    const resolvedDate =
      response_date || new Date().toISOString().split("T")[0];

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
