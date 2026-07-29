import { describeActionError } from "@/lib/supabase/errors";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

export function success(): ActionResult;
export function success<T>(data: T): ActionResult<T>;
export function success<T>(data?: T) {
  return { ok: true, data } as ActionResult<T>;
}

export function failure(error: unknown): { ok: false; error: string } {
  return { ok: false, error: describeActionError(error) };
}

/**
 * `redirect()` do Next funciona lançando um erro de controle. Ele precisa
 * atravessar qualquer try/catch, senão a navegação nunca acontece.
 */
export function isNextControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}
