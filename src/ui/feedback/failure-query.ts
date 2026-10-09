/**
 * Query suffix that carries a failed action's error code back to the page it redirects to.
 * The page reads `error` and shows a toast (see ErrorToast). Returns '' on success.
 */
export function failureQuery(result: { ok: boolean; error?: { code: string } }): string {
  return result.ok || !result.error ? '' : `?error=${encodeURIComponent(result.error.code)}`;
}
