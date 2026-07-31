-- =====================================================================
-- 17 — Rede de segurança: deduplicação de group_members + reforço da
-- unicidade (group_id, user_id).
--
-- group_members já tem primary key (group_id, user_id) desde o schema
-- base (20260701000000_init_schema.sql), então duplicidades exatas não
-- deveriam existir por construção. Esta migration existe como defesa em
-- profundidade contra dados que tenham chegado à tabela fora do caminho
-- normal (import manual, restauração parcial, etc.): remove qualquer
-- duplicidade residual para o mesmo par (group_id, user_id) — priorizando
-- sempre a linha com role 'owner' — e só então confirma a constraint de
-- unicidade, sem recriar nada se a própria primary key já cobre o par.
-- =====================================================================

delete from public.group_members gm
using (
  select
    ctid,
    row_number() over (
      partition by group_id, user_id
      order by (role = 'owner') desc, joined_at asc
    ) as rn
  from public.group_members
) dupes
where gm.ctid = dupes.ctid
  and dupes.rn > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.group_members'::regclass
      and c.contype in ('p', 'u')
      and (
        select array_agg(a.attname::text order by a.attname)
        from unnest(c.conkey) as k(attnum)
        join pg_attribute a
          on a.attrelid = c.conrelid and a.attnum = k.attnum
      ) = array['group_id', 'user_id']::text[]
  ) then
    alter table public.group_members
      add constraint group_members_group_id_user_id_key unique (group_id, user_id);
  end if;
end $$;
