"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Mantém a tela em dia quando outro admin lança ou edita uma partida.
 *
 * Não aplicamos o payload do evento na tela: pedimos ao servidor para
 * revalidar. Assim o dado exibido sempre passou por RLS, e não há risco de
 * duplicar item ou mostrar algo que o usuário não poderia ver. Realtime aqui
 * é gatilho de atualização, nunca fonte de verdade.
 */
export function GroupRealtime({ groupId }: { groupId: string }) {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Rajadas de eventos (uma partida = 1 match + 4 match_players) viram
    // uma única revalidação.
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel(`grupo:${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `group_id=eq.${groupId}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `group_id=eq.${groupId}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `group_id=eq.${groupId}` },
        scheduleRefresh,
      )
      // match_players não tem group_id; a RLS já limita o que chega aqui.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_players" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [groupId, router]);

  return null;
}
