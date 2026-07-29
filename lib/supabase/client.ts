"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Cliente do navegador. Usa exclusivamente a chave publishable — nunca a
 * service_role. Toda autorização real está na RLS.
 */
export function createClient() {
  cached ??= createBrowserClient<Database>(getSupabaseUrl(), getSupabasePublishableKey());
  return cached;
}
