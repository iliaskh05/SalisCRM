/** Message lisible d'une erreur d'Edge Function (le corps JSON { error } de la réponse). */
export async function edgeFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === "function") {
    try {
      const body = (await context.json()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      // réponse non JSON : message générique ci-dessous
    }
  }
  return error instanceof Error ? error.message : "Opération impossible";
}
