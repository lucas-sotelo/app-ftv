-- =====================================================================
-- 03 — Operações transacionais (RPC).
--
-- Uma partida nunca é gravada por vários inserts soltos vindos do
-- navegador: tudo passa por estas funções, numa única transação.
--
-- Elas são SECURITY INVOKER sempre que possível — a RLS continua sendo a
-- última linha de defesa. Só usam SECURITY DEFINER os casos em que o
-- usuário legitimamente ainda não tem acesso à linha (criar grupo,
-- resgatar convite) e a escrita da auditoria.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Auditoria (única porta de escrita em audit_log)
-- ---------------------------------------------------------------------
create or replace function public.write_audit(
  p_group_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_log (group_id, actor_user_id, entity_type, entity_id, action, before_data, after_data)
  values (p_group_id, (select auth.uid()), p_entity_type, p_entity_id, p_action, p_before, p_after);
end;
$$;

revoke execute on function public.write_audit(uuid, text, uuid, text, jsonb, jsonb) from public;
grant execute on function public.write_audit(uuid, text, uuid, text, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- slugify
-- ---------------------------------------------------------------------
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select nullif(
    trim(both '-' from regexp_replace(
      lower(translate(
        coalesce(p_text, ''),
        'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
      )),
      '[^a-z0-9]+', '-', 'g'
    )),
    ''
  );
$$;

-- ---------------------------------------------------------------------
-- create_group_with_owner
-- ---------------------------------------------------------------------
create or replace function public.create_group_with_owner(
  p_name text,
  p_slug text default null,
  p_timezone text default 'America/Sao_Paulo',
  p_ranking_min_games integer default 1
)
returns public.groups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_base text;
  v_slug text;
  v_try integer := 0;
  v_group public.groups;
begin
  if v_uid is null then
    raise exception 'É preciso estar autenticado para criar um grupo.'
      using errcode = '42501', hint = 'FTV_UNAUTHENTICATED';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Informe o nome do grupo.'
      using errcode = 'check_violation', hint = 'FTV_INVALID_NAME';
  end if;

  v_base := coalesce(public.slugify(p_slug), public.slugify(p_name), 'grupo');
  v_slug := v_base;
  loop
    exit when not exists (select 1 from public.groups g where g.slug = v_slug);
    v_try := v_try + 1;
    v_slug := v_base || '-' || v_try::text;
    if v_try > 200 then
      raise exception 'Não foi possível gerar um endereço único para o grupo.'
        using errcode = 'check_violation', hint = 'FTV_SLUG_EXHAUSTED';
    end if;
  end loop;

  insert into public.groups (name, slug, timezone, ranking_min_games, created_by)
  values (btrim(p_name), v_slug, coalesce(nullif(btrim(p_timezone), ''), 'America/Sao_Paulo'),
          greatest(coalesce(p_ranking_min_games, 1), 1), v_uid)
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_uid, 'owner');

  perform public.write_audit(v_group.id, 'group', v_group.id, 'create', null, to_jsonb(v_group));

  return v_group;
end;
$$;

revoke execute on function public.create_group_with_owner(text, text, text, integer) from public;
grant execute on function public.create_group_with_owner(text, text, text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- create_group_invitation — o código é gerado no servidor
-- ---------------------------------------------------------------------
create or replace function public.create_group_invitation(
  p_group_id uuid,
  p_role public.group_role default 'member',
  p_expires_at timestamptz default null,
  p_max_uses integer default null
)
returns public.group_invitations
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text;
  v_row public.group_invitations;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'Apenas proprietário ou administrador pode criar convites.'
      using errcode = '42501', hint = 'FTV_FORBIDDEN';
  end if;

  if p_role = 'owner' then
    raise exception 'Um convite não pode conceder propriedade do grupo.'
      using errcode = 'check_violation', hint = 'FTV_INVITE_OWNER';
  end if;

  loop
    -- 10 caracteres base32-ish, sem ambiguidade visual.
    v_code := upper(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=IOl01', 'ABCDXYZW'));
    v_code := substring(v_code from 1 for 10);
    exit when not exists (select 1 from public.group_invitations gi where gi.code = v_code);
  end loop;

  insert into public.group_invitations (group_id, code, role, expires_at, max_uses, created_by)
  values (p_group_id, v_code, p_role, p_expires_at, p_max_uses, v_uid)
  returning * into v_row;

  perform public.write_audit(p_group_id, 'invitation', v_row.id, 'create', null, to_jsonb(v_row));

  return v_row;
end;
$$;

revoke execute on function public.create_group_invitation(uuid, public.group_role, timestamptz, integer) from public;
grant execute on function public.create_group_invitation(uuid, public.group_role, timestamptz, integer) to authenticated;

-- ---------------------------------------------------------------------
-- revoke_group_invitation
-- ---------------------------------------------------------------------
create or replace function public.revoke_group_invitation(p_invitation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_before public.group_invitations;
begin
  select * into v_before from public.group_invitations where id = p_invitation_id;
  if v_before.id is null then
    raise exception 'Convite não encontrado.' using errcode = 'no_data_found', hint = 'FTV_NOT_FOUND';
  end if;

  update public.group_invitations set revoked_at = now() where id = p_invitation_id;

  perform public.write_audit(v_before.group_id, 'invitation', p_invitation_id, 'revoke',
                             to_jsonb(v_before), null);
end;
$$;

revoke execute on function public.revoke_group_invitation(uuid) from public;
grant execute on function public.revoke_group_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- redeem_group_invitation
-- ---------------------------------------------------------------------
create or replace function public.redeem_group_invitation(p_code text)
returns public.groups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.group_invitations;
  v_group public.groups;
begin
  if v_uid is null then
    raise exception 'É preciso estar autenticado para entrar em um grupo.'
      using errcode = '42501', hint = 'FTV_UNAUTHENTICATED';
  end if;

  select * into v_inv
  from public.group_invitations
  where upper(btrim(code)) = upper(btrim(p_code))
  for update;

  if v_inv.id is null then
    raise exception 'Convite inválido.' using errcode = 'no_data_found', hint = 'FTV_INVITE_INVALID';
  end if;

  if v_inv.revoked_at is not null then
    raise exception 'Este convite foi revogado.' using errcode = 'check_violation', hint = 'FTV_INVITE_REVOKED';
  end if;

  if v_inv.expires_at is not null and v_inv.expires_at <= now() then
    raise exception 'Este convite expirou.' using errcode = 'check_violation', hint = 'FTV_INVITE_EXPIRED';
  end if;

  select * into v_group from public.groups where id = v_inv.group_id;

  -- Resgatar duas vezes não deve consumir dois usos nem quebrar.
  if exists (select 1 from public.group_members gm
             where gm.group_id = v_inv.group_id and gm.user_id = v_uid) then
    return v_group;
  end if;

  if v_inv.max_uses is not null and v_inv.use_count >= v_inv.max_uses then
    raise exception 'Este convite atingiu o limite de usos.'
      using errcode = 'check_violation', hint = 'FTV_INVITE_EXHAUSTED';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_inv.group_id, v_uid, v_inv.role);

  update public.group_invitations
  set use_count = use_count + 1
  where id = v_inv.id;

  perform public.write_audit(v_inv.group_id, 'member', v_inv.group_id, 'join',
                             null, jsonb_build_object('user_id', v_uid, 'role', v_inv.role));

  return v_group;
end;
$$;

revoke execute on function public.redeem_group_invitation(text) from public;
grant execute on function public.redeem_group_invitation(text) to authenticated;

-- ---------------------------------------------------------------------
-- get_or_create_session — evita corrida entre dois admins na mesma data
-- ---------------------------------------------------------------------
create or replace function public.get_or_create_session(
  p_group_id uuid,
  p_played_on date,
  p_title text default null,
  p_location text default null,
  p_notes text default null
)
returns public.sessions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.sessions;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'Apenas proprietário ou administrador pode criar rodadas.'
      using errcode = '42501', hint = 'FTV_FORBIDDEN';
  end if;

  select * into v_row from public.sessions
  where group_id = p_group_id and played_on = p_played_on;

  if v_row.id is not null then
    return v_row;
  end if;

  insert into public.sessions (group_id, played_on, title, location, notes, created_by)
  values (p_group_id, p_played_on, nullif(btrim(p_title), ''), nullif(btrim(p_location), ''),
          nullif(btrim(p_notes), ''), v_uid)
  on conflict (group_id, played_on) do update set played_on = excluded.played_on
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.get_or_create_session(uuid, date, text, text, text) from public;
grant execute on function public.get_or_create_session(uuid, date, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Validação compartilhada entre create_match e update_match
-- ---------------------------------------------------------------------
create or replace function public.resolve_match_outcome(
  p_winning_side public.match_side,
  p_team_a_score integer,
  p_team_b_score integer
)
returns public.match_side
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  v_side public.match_side;
begin
  if (p_team_a_score is null) <> (p_team_b_score is null) then
    raise exception 'Informe os dois placares ou nenhum.'
      using errcode = 'check_violation', hint = 'FTV_SCORE_PARTIAL';
  end if;

  if p_team_a_score is null then
    if p_winning_side is null then
      raise exception 'Sem placar, é obrigatório escolher o time vencedor.'
        using errcode = 'check_violation', hint = 'FTV_WINNER_REQUIRED';
    end if;
    return p_winning_side;
  end if;

  if p_team_a_score = p_team_b_score then
    raise exception 'A partida não pode terminar empatada.'
      using errcode = 'check_violation', hint = 'FTV_SCORE_TIE';
  end if;

  -- Com placar, o vencedor é sempre derivado do maior valor.
  v_side := case when p_team_a_score > p_team_b_score then 'A'::public.match_side
                 else 'B'::public.match_side end;

  if p_winning_side is not null and p_winning_side <> v_side then
    raise exception 'O time vencedor não confere com o placar informado.'
      using errcode = 'check_violation', hint = 'FTV_SCORE_WINNER_MISMATCH';
  end if;

  return v_side;
end;
$$;

create or replace function public.assert_valid_lineup(
  p_group_id uuid,
  p_team_a uuid[],
  p_team_b uuid[],
  p_allow_player_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_all uuid[] := p_team_a || p_team_b;
  v_bad record;
begin
  if array_length(p_team_a, 1) is distinct from 2 or array_length(p_team_b, 1) is distinct from 2 then
    raise exception 'Cada time precisa de exatamente 2 jogadores.'
      using errcode = 'check_violation', hint = 'FTV_TEAM_SIZE';
  end if;

  if (select count(distinct x) from unnest(v_all) as x) <> 4 then
    raise exception 'A partida precisa de 4 jogadores distintos.'
      using errcode = 'check_violation', hint = 'FTV_DUPLICATE_PLAYER';
  end if;

  for v_bad in
    select x from unnest(v_all) as x
    where not exists (select 1 from public.players p where p.id = x and p.group_id = p_group_id)
  loop
    raise exception 'Jogador % não pertence a este grupo.', v_bad.x
      using errcode = 'check_violation', hint = 'FTV_PLAYER_OTHER_GROUP';
  end loop;

  -- Jogador inativo não entra em partida nova, mas continua no histórico:
  -- por isso p_allow_player_ids libera quem já estava escalado.
  for v_bad in
    select p.display_name as x
    from public.players p
    where p.id = any (v_all)
      and p.active = false
      and not (p.id = any (coalesce(p_allow_player_ids, '{}'::uuid[])))
  loop
    raise exception 'O jogador % está inativo e não pode entrar em uma partida.', v_bad.x
      using errcode = 'check_violation', hint = 'FTV_INACTIVE_PLAYER';
  end loop;
end;
$$;

revoke execute on function public.assert_valid_lineup(uuid, uuid[], uuid[], uuid[]) from public;
grant execute on function public.assert_valid_lineup(uuid, uuid[], uuid[], uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- create_match
-- ---------------------------------------------------------------------
create or replace function public.create_match(
  p_group_id uuid,
  p_played_at timestamptz,
  p_team_a uuid[],
  p_team_b uuid[],
  p_winning_side public.match_side default null,
  p_team_a_score integer default null,
  p_team_b_score integer default null,
  p_session_id uuid default null,
  p_notes text default null,
  p_external_key text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_side public.match_side;
  v_match_id uuid;
  v_existing uuid;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'Apenas proprietário ou administrador pode registrar partidas.'
      using errcode = '42501', hint = 'FTV_FORBIDDEN';
  end if;

  -- Importação idempotente: mesma chave, mesma partida.
  if p_external_key is not null then
    select id into v_existing from public.matches
    where group_id = p_group_id and external_key = p_external_key;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  v_side := public.resolve_match_outcome(p_winning_side, p_team_a_score, p_team_b_score);
  perform public.assert_valid_lineup(p_group_id, p_team_a, p_team_b);

  if p_session_id is not null and not exists (
    select 1 from public.sessions s where s.id = p_session_id and s.group_id = p_group_id
  ) then
    raise exception 'A rodada informada não pertence a este grupo.'
      using errcode = 'check_violation', hint = 'FTV_SESSION_OTHER_GROUP';
  end if;

  insert into public.matches (
    group_id, session_id, played_at, winning_side,
    team_a_score, team_b_score, notes, external_key, created_by
  )
  values (
    p_group_id, p_session_id, p_played_at, v_side,
    p_team_a_score, p_team_b_score, nullif(btrim(p_notes), ''), p_external_key, v_uid
  )
  returning id into v_match_id;

  insert into public.match_players (match_id, player_id, side, slot)
  values
    (v_match_id, p_team_a[1], 'A', 1),
    (v_match_id, p_team_a[2], 'A', 2),
    (v_match_id, p_team_b[1], 'B', 1),
    (v_match_id, p_team_b[2], 'B', 2);

  perform public.write_audit(
    p_group_id, 'match', v_match_id, 'create', null,
    jsonb_build_object(
      'played_at', p_played_at, 'winning_side', v_side,
      'team_a_score', p_team_a_score, 'team_b_score', p_team_b_score,
      'team_a', p_team_a, 'team_b', p_team_b, 'session_id', p_session_id
    )
  );

  return v_match_id;
end;
$$;

revoke execute on function public.create_match(uuid, timestamptz, uuid[], uuid[], public.match_side, integer, integer, uuid, text, text) from public;
grant execute on function public.create_match(uuid, timestamptz, uuid[], uuid[], public.match_side, integer, integer, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- update_match
-- ---------------------------------------------------------------------
create or replace function public.update_match(
  p_match_id uuid,
  p_played_at timestamptz,
  p_team_a uuid[],
  p_team_b uuid[],
  p_winning_side public.match_side default null,
  p_team_a_score integer default null,
  p_team_b_score integer default null,
  p_session_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_before jsonb;
  v_match public.matches;
  v_side public.match_side;
  v_current uuid[];
begin
  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'Partida não encontrada.' using errcode = 'no_data_found', hint = 'FTV_NOT_FOUND';
  end if;

  if not public.is_group_admin(v_match.group_id) then
    raise exception 'Apenas proprietário ou administrador pode editar partidas.'
      using errcode = '42501', hint = 'FTV_FORBIDDEN';
  end if;

  v_side := public.resolve_match_outcome(p_winning_side, p_team_a_score, p_team_b_score);

  select coalesce(array_agg(player_id), '{}'::uuid[]) into v_current
  from public.match_players where match_id = p_match_id;

  perform public.assert_valid_lineup(v_match.group_id, p_team_a, p_team_b, v_current);

  if p_session_id is not null and not exists (
    select 1 from public.sessions s where s.id = p_session_id and s.group_id = v_match.group_id
  ) then
    raise exception 'A rodada informada não pertence a este grupo.'
      using errcode = 'check_violation', hint = 'FTV_SESSION_OTHER_GROUP';
  end if;

  v_before := to_jsonb(v_match) || jsonb_build_object('players', v_current);

  update public.matches
  set played_at = p_played_at,
      session_id = p_session_id,
      winning_side = v_side,
      team_a_score = p_team_a_score,
      team_b_score = p_team_b_score,
      notes = nullif(btrim(p_notes), ''),
      updated_by = v_uid
  where id = p_match_id;

  delete from public.match_players where match_id = p_match_id;
  insert into public.match_players (match_id, player_id, side, slot)
  values
    (p_match_id, p_team_a[1], 'A', 1),
    (p_match_id, p_team_a[2], 'A', 2),
    (p_match_id, p_team_b[1], 'B', 1),
    (p_match_id, p_team_b[2], 'B', 2);

  perform public.write_audit(
    v_match.group_id, 'match', p_match_id, 'update', v_before,
    jsonb_build_object(
      'played_at', p_played_at, 'winning_side', v_side,
      'team_a_score', p_team_a_score, 'team_b_score', p_team_b_score,
      'team_a', p_team_a, 'team_b', p_team_b, 'session_id', p_session_id
    )
  );

  return p_match_id;
end;
$$;

revoke execute on function public.update_match(uuid, timestamptz, uuid[], uuid[], public.match_side, integer, integer, uuid, text) from public;
grant execute on function public.update_match(uuid, timestamptz, uuid[], uuid[], public.match_side, integer, integer, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- void_match / delete_match / restore_match
-- ---------------------------------------------------------------------
create or replace function public.void_match(p_match_id uuid, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'Partida não encontrada.' using errcode = 'no_data_found', hint = 'FTV_NOT_FOUND';
  end if;
  if not public.is_group_admin(v_match.group_id) then
    raise exception 'Apenas proprietário ou administrador pode anular partidas.'
      using errcode = '42501', hint = 'FTV_FORBIDDEN';
  end if;

  update public.matches
  set status = 'voided',
      notes = coalesce(nullif(btrim(p_reason), ''), notes),
      updated_by = (select auth.uid())
  where id = p_match_id;

  perform public.write_audit(v_match.group_id, 'match', p_match_id, 'void',
                             to_jsonb(v_match), jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.delete_match(p_match_id uuid, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'Partida não encontrada.' using errcode = 'no_data_found', hint = 'FTV_NOT_FOUND';
  end if;
  if not public.is_group_admin(v_match.group_id) then
    raise exception 'Apenas proprietário ou administrador pode excluir partidas.'
      using errcode = '42501', hint = 'FTV_FORBIDDEN';
  end if;

  -- Exclusão lógica: sai das estatísticas, permanece na auditoria.
  update public.matches
  set deleted_at = now(),
      deleted_by = (select auth.uid()),
      updated_by = (select auth.uid())
  where id = p_match_id and deleted_at is null;

  perform public.write_audit(v_match.group_id, 'match', p_match_id, 'soft_delete',
                             to_jsonb(v_match), jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.restore_match(p_match_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'Partida não encontrada.' using errcode = 'no_data_found', hint = 'FTV_NOT_FOUND';
  end if;
  if not public.is_group_admin(v_match.group_id) then
    raise exception 'Apenas proprietário ou administrador pode restaurar partidas.'
      using errcode = '42501', hint = 'FTV_FORBIDDEN';
  end if;

  update public.matches
  set status = 'confirmed',
      deleted_at = null,
      deleted_by = null,
      updated_by = (select auth.uid())
  where id = p_match_id;

  perform public.write_audit(v_match.group_id, 'match', p_match_id, 'restore', to_jsonb(v_match), null);
end;
$$;

revoke execute on function public.void_match(uuid, text) from public;
revoke execute on function public.delete_match(uuid, text) from public;
revoke execute on function public.restore_match(uuid) from public;
grant execute on function public.void_match(uuid, text) to authenticated;
grant execute on function public.delete_match(uuid, text) to authenticated;
grant execute on function public.restore_match(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- set_member_role — regras de owner concentradas em um lugar
-- ---------------------------------------------------------------------
create or replace function public.set_member_role(
  p_group_id uuid,
  p_user_id uuid,
  p_role public.group_role
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_current public.group_role;
begin
  select role into v_current from public.group_members
  where group_id = p_group_id and user_id = p_user_id;

  if v_current is null then
    raise exception 'Este usuário não é membro do grupo.'
      using errcode = 'no_data_found', hint = 'FTV_NOT_MEMBER';
  end if;

  if (p_role = 'owner' or v_current = 'owner') and not public.is_group_owner(p_group_id) then
    raise exception 'Apenas o proprietário pode alterar papéis de proprietário.'
      using errcode = '42501', hint = 'FTV_OWNER_ONLY';
  end if;

  if not public.is_group_admin(p_group_id) then
    raise exception 'Apenas proprietário ou administrador pode alterar papéis.'
      using errcode = '42501', hint = 'FTV_FORBIDDEN';
  end if;

  update public.group_members set role = p_role
  where group_id = p_group_id and user_id = p_user_id;

  perform public.write_audit(p_group_id, 'member', p_group_id, 'role_change',
    jsonb_build_object('user_id', p_user_id, 'role', v_current),
    jsonb_build_object('user_id', p_user_id, 'role', p_role));
end;
$$;

revoke execute on function public.set_member_role(uuid, uuid, public.group_role) from public;
grant execute on function public.set_member_role(uuid, uuid, public.group_role) to authenticated;
