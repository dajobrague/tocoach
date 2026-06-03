/**
 * Whether to show macro numbers to the client in the meal-cycle view.
 *
 * TODO(nutrition-v2): honor a per-client / per-trainer "show macros to client"
 * setting once one exists. None exists in the schema today and this slice
 * deliberately does NOT introduce one (see P4-T2). Until then macros are shown.
 *
 * Every macro render in the client view goes through this single gate, so
 * wiring the real setting — or flipping the default — is a one-line change here
 * (e.g. accept a `ClientMacroSettings` arg and read it) with no UI churn.
 */
export function shouldShowMacrosToClient(): boolean {
  return true;
}
