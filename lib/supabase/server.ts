import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "./database.types";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Cliente para Server Components, Route Handlers e Server Actions.
 * Continua usando a chave publishable: a sessão do usuário vem do cookie e a
 * RLS decide o que ele pode ver.
 *
 * Memoizado por requisição (React cache()): sem isso, cada Server Component
 * da mesma requisição criava sua própria instância, o que impedia
 * getGroupContext/getCurrentUser de deduplicar chamadas repetidas (cache()
 * do React compara argumentos por referência).
 */
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component não pode escrever cookie. O middleware já cuida
          // da renovação da sessão, então ignorar aqui é seguro.
        }
      },
    },
  });
});

/**
 * Usuário autenticado validado no servidor, ou null.
 *
 * Memoizado por requisição: `auth.getUser()` sempre revalida contra o
 * servidor de Auth (ao contrário de `getSession()`), então mesmo reusando a
 * mesma instância de cliente cada chamada seria um novo round-trip sem este
 * cache().
 */
export const getCurrentUser = cache(async function getCurrentUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
