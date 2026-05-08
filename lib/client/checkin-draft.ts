/**
 * Client-side drafts for the check-in / habits modal so in-progress answers
 * survive app backgrounding, tab reloads, and accidental pull-to-refresh
 * before "Enviar". Mirrors `lib/client/exercise-log-draft.ts` — same
 * sessionStorage + TTL recipe, different key shape (no per-set complexity).
 *
 * Drafts are scoped per (clientId, formType, responseDate). When the user
 * is editing an existing server-stored response we DO NOT load the draft —
 * the server copy is canonical and any local draft is stale.
 */

const PREFIX = "tc_form_response_draft:";
/** Drop drafts older than this so stale data does not override fresh server logs. */
const DRAFT_TTL_MS = 48 * 60 * 60 * 1000;

export type FormResponseDraftAnswers = Record<string, unknown>;

export function formResponseDraftStorageKey(
  clientId: string,
  formType: "checkins" | "habits",
  responseDate: string
): string {
  return `${PREFIX}${clientId}:${formType}:${responseDate}`;
}

export type FormResponseDraftRead = {
  answers: FormResponseDraftAnswers;
  updatedAt: number;
};

export function readFormResponseDraft(
  key: string
): FormResponseDraftRead | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);

    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      answers?: FormResponseDraftAnswers;
      updatedAt?: number;
    };

    if (!parsed?.answers || typeof parsed.answers !== "object") {
      return null;
    }
    const updatedAt =
      typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0;

    if (Date.now() - updatedAt > DRAFT_TTL_MS) {
      sessionStorage.removeItem(key);

      return null;
    }

    return { answers: parsed.answers, updatedAt };
  } catch {
    return null;
  }
}

export function writeFormResponseDraft(
  key: string,
  answers: FormResponseDraftAnswers
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ answers, updatedAt: Date.now() })
    );
  } catch {
    // Quota or private mode — ignore
  }
}

export function clearFormResponseDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
