import type {
  ClientReadiness,
  ClientDietVerdict,
} from "@/lib/nutrition/rollout/readiness-service";

export type { ClientReadiness, ClientDietVerdict };

/** Both flags + every client's post-switch verdict (see the readiness route). */
export interface NutritionUpdateReadiness {
  flags: { enabled: boolean; trainerEnabled: boolean };
  clients: ClientReadiness[];
}

/** The three transitions the wizard can perform. */
export type NutritionUpdateAction =
  | "enable_trainer"
  | "activate_clients"
  | "deactivate_clients";

async function readData<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (data?.success !== true) {
    throw new Error(data?.error ?? "Error de red");
  }

  return data.data as T;
}

export async function fetchReadiness(): Promise<NutritionUpdateReadiness> {
  const response = await fetch("/api/nutrition-update/readiness", {
    credentials: "same-origin",
    cache: "no-store",
  });

  return readData<NutritionUpdateReadiness>(response);
}

export async function postFlagAction(
  action: NutritionUpdateAction
): Promise<void> {
  const response = await fetch("/api/nutrition-update/flags", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const data = await response.json();

  if (data?.success !== true) {
    throw new Error(data?.error ?? "Error de red");
  }
}

/** Group sizes for the summary strip, ⚠️ first in importance. */
export function summarizeVerdicts(clients: ClientReadiness[]): {
  atRisk: number;
  pdf: number;
  goals: number;
  planV2: number;
  none: number;
} {
  const count = (verdict: ClientDietVerdict): number =>
    clients.filter((client) => client.verdict === verdict).length;

  return {
    atRisk: count("at_risk"),
    pdf: count("pdf"),
    goals: count("goals"),
    planV2: count("plan_v2"),
    none: count("none"),
  };
}
