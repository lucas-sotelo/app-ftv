-- =====================================================================
-- 05 — Realtime.
--
-- O realtime existe só para atualizar a tela quando outro admin lança uma
-- partida. Ele nunca é fonte de verdade: ao receber um evento o cliente
-- revalida os dados pelo caminho normal, que passa por RLS.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['matches', 'match_players', 'players', 'sessions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;
