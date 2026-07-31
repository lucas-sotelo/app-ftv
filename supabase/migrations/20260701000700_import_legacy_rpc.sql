-- =====================================================================
-- 07 — RPC de importação legada (uso exclusivo do script service_role).
--
-- create_match já suporta played_at e external_key, mas exige
-- is_group_admin(), que depende de auth.uid() — inexistente numa sessão
-- service_role. Sem uma RPC própria, o script de importação caía de volta
-- para inserts soltos via REST, cada um em sua própria transação: o
-- insert em matches confirmava sozinho, a constraint trigger deferida
-- rodava no commit desse insert (antes de match_players existir) e
-- disparava "Cada partida precisa de exatamente 2 jogadores por lado
-- (A=0, B=0)". Esta função faz os dois inserts na mesma transação
-- (mesma chamada de função), como create_match já faz para o app.
-- =====================================================================

create or replace function public.import_legacy_match(
  p_group_id uuid,
  p_played_at timestamptz,
  p_team_a uuid[],
  p_team_b uuid[],
  p_winning_side public.match_side,
  p_created_by uuid,
  p_session_id uuid default null,
  p_external_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match_id uuid;
  v_existing uuid;
begin
  if p_external_key is not null then
    select id into v_existing from public.matches
    where group_id = p_group_id and external_key = p_external_key;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  perform public.assert_valid_lineup(p_group_id, p_team_a, p_team_b);

  if p_session_id is not null and not exists (
    select 1 from public.sessions s where s.id = p_session_id and s.group_id = p_group_id
  ) then
    raise exception 'A rodada informada não pertence a este grupo.'
      using errcode = 'check_violation', hint = 'FTV_SESSION_OTHER_GROUP';
  end if;

  insert into public.matches (
    group_id, session_id, played_at, winning_side, external_key, created_by
  )
  values (
    p_group_id, p_session_id, p_played_at, p_winning_side, p_external_key, p_created_by
  )
  returning id into v_match_id;

  insert into public.match_players (match_id, player_id, side, slot)
  values
    (v_match_id, p_team_a[1], 'A', 1),
    (v_match_id, p_team_a[2], 'A', 2),
    (v_match_id, p_team_b[1], 'B', 1),
    (v_match_id, p_team_b[2], 'B', 2);

  return v_match_id;
end;
$$;

-- Só o script de importação (service_role) pode chamar: pula
-- is_group_admin() de propósito, então não pode ficar acessível a
-- usuários autenticados comuns.
revoke execute on function public.import_legacy_match(uuid, timestamptz, uuid[], uuid[], public.match_side, uuid, uuid, text) from public;
revoke execute on function public.import_legacy_match(uuid, timestamptz, uuid[], uuid[], public.match_side, uuid, uuid, text) from authenticated;
grant execute on function public.import_legacy_match(uuid, timestamptz, uuid[], uuid[], public.match_side, uuid, uuid, text) to service_role;
