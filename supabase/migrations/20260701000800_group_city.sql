-- =====================================================================
-- 08 — Cidade do grupo (apresentação) + create_group_with_owner atualizado.
--
-- O fluxo de criação na Home precisa pedir a cidade explicitamente e
-- parar de deixar o usuário escolher fuso horário: o app sempre grava
-- 'America/Sao_Paulo' e mostra a cidade como identificação amigável do
-- grupo. `city` é só apresentação — não entra em cálculo de estatística.
-- =====================================================================

alter table public.groups
  add column if not exists city text null;

alter table public.groups
  add constraint groups_city_not_blank check (city is null or btrim(city) <> '');

-- create_group_with_owner ganha p_city. Como isso muda a lista de
-- argumentos, a função anterior precisa ser removida antes: "create or
-- replace" não troca a assinatura, só o corpo de uma assinatura igual.
drop function if exists public.create_group_with_owner(text, text, text, integer);

create or replace function public.create_group_with_owner(
  p_name text,
  p_slug text default null,
  p_timezone text default 'America/Sao_Paulo',
  p_ranking_min_games integer default 1,
  p_city text default null
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

  insert into public.groups (name, slug, timezone, ranking_min_games, city, created_by)
  values (btrim(p_name), v_slug, coalesce(nullif(btrim(p_timezone), ''), 'America/Sao_Paulo'),
          greatest(coalesce(p_ranking_min_games, 1), 1), nullif(btrim(p_city), ''), v_uid)
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_uid, 'owner');

  perform public.write_audit(v_group.id, 'group', v_group.id, 'create', null, to_jsonb(v_group));

  return v_group;
end;
$$;

revoke execute on function public.create_group_with_owner(text, text, text, integer, text) from public;
grant execute on function public.create_group_with_owner(text, text, text, integer, text) to authenticated;
