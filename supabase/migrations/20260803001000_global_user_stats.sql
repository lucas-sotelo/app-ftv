-- =====================================================================
-- Estatísticas globais do usuário autenticado, consolidando todos os
-- jogadores vinculados (players.linked_user_id) em todos os grupos de
-- que participa — base do resumo de engajamento na Home (/comecar).
--
-- security invoker, com o filtro travado em (select auth.uid()): o
-- resultado nunca deve depender do valor recebido em p_user_id (só
-- existe como parâmetro para deixar a assinatura explícita sobre de
-- quem são as estatísticas). v_match_participants já é security_invoker
-- e a RLS de matches/players restringiria a grupos do próprio chamador
-- de qualquer forma, mas travar em auth.uid() evita qualquer ambiguidade
-- — chamar com o id de outra pessoa sempre devolve os dados do próprio
-- chamador (nunca uma soma parcial vazando participação em grupos).
-- =====================================================================
create or replace function public.get_global_user_stats(p_user_id uuid)
returns table (
  total_matches bigint,
  total_wins bigint,
  global_win_rate numeric,
  global_saldo bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with my_players as (
    select p.id as player_id
    from public.players p
    where p.linked_user_id = (select auth.uid())
      and p_user_id = (select auth.uid())
  ),
  scoped as (
    select vp.won
    from public.v_match_participants vp
    where vp.player_id in (select player_id from my_players)
  ),
  agg as (
    select
      count(*)::bigint as total_matches,
      count(*) filter (where won)::bigint as total_wins
    from scoped
  )
  select
    a.total_matches,
    a.total_wins,
    case
      when a.total_matches > 0 then a.total_wins::numeric / a.total_matches
      else 0
    end as global_win_rate,
    (2 * a.total_wins - a.total_matches)::bigint as global_saldo
  from agg a;
$$;

comment on function public.get_global_user_stats(uuid) is
  'Partidas, vitórias, win rate e saldo (V-D) do usuário somando todos os jogadores vinculados a ele em todos os grupos. Sempre resolve para o próprio chamador (auth.uid()), independente do p_user_id recebido.';

revoke execute on function public.get_global_user_stats(uuid) from public;
grant execute on function public.get_global_user_stats(uuid) to authenticated;
