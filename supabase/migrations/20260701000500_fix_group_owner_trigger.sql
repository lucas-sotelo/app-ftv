-- =====================================================================
-- 05 — Correção: o trigger que garante "grupo sempre tem owner" rodava
-- como SECURITY INVOKER. O SELECT interno em public.groups (usado para
-- detectar se o grupo inteiro está sendo apagado, e nesse caso pular a
-- checagem) ficava sujeito à RLS de "groups: só os grupos de que
-- participo". No exato momento em que o próprio owner remove sua linha
-- de group_members, ele deixa de ser membro do grupo NA MESMA
-- transação — a RLS então esconde o grupo dele, o SELECT não encontra
-- nada, o trigger cai no "return null" pensando que o grupo foi
-- apagado, e a checagem real do invariante nunca roda.
--
-- Corrigido tornando a função SECURITY DEFINER, igual às demais funções
-- de autorização deste projeto (is_group_member, is_group_admin, etc.),
-- para que ela enxergue o estado real das tabelas independente de RLS.
-- =====================================================================

create or replace function public.tg_group_requires_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group_id uuid := coalesce(new.group_id, old.group_id);
begin
  -- Se o próprio grupo está sendo apagado (cascade), não há invariante a manter.
  if not exists (select 1 from public.groups g where g.id = v_group_id) then
    return null;
  end if;

  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = v_group_id and gm.role = 'owner'
  ) then
    raise exception 'O grupo precisa ter pelo menos um proprietário.'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

comment on function public.tg_group_requires_owner() is
  'SECURITY DEFINER: precisa enxergar groups/group_members sem o filtro de RLS, '
  'porque no momento do DELETE do owner ele já deixou de ser membro do grupo.';

revoke execute on function public.tg_group_requires_owner() from public, authenticated, anon;