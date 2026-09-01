-- =====================================================================
-- 24 — delete_group: exclusão definitiva de um grupo.
--
-- A RLS já tinha a policy "groups: só owner apaga" (for delete, using
-- is_group_owner) desde 20260701000100 — o dado sempre esteve protegido
-- corretamente. O que faltava era só a ponta de aplicação: nenhuma action
-- ou RPC chamava esse delete, então a funcionalidade nunca existiu de
-- verdade pra quem usa o app.
--
-- SECURITY INVOKER (não DEFINER): a RLS de "groups" já autoriza owner a
-- apagar, então o invoker resolve. A única exceção precisa de privilégio
-- elevado é write_audit (audit_log bloqueia insert direto de
-- authenticated/anon) — e write_audit já é SECURITY DEFINER por conta
-- própria, então chamá-la daqui não exige elevar esta função também.
--
-- A checagem explícita de is_group_owner() antes de tudo evita um caso
-- estranho: sem ela, um membro não-owner conseguiria gerar um registro de
-- auditoria "grupo excluído" mesmo com o delete final sendo silenciosamente
-- bloqueado pela RLS (0 linhas afetadas, sem erro) — um log falso.
--
-- Cascata: todas as FKs de group_id (group_members, players, sessions,
-- matches, group_invitations, player_badges) já são "on delete cascade"
-- desde o schema inicial — ver 20260701000000_init_schema.sql e
-- 20260701002200_create_badges.sql. audit_log é a única exceção
-- deliberada: guarda group_id sem FK, então o rastro de auditoria (incluindo
-- o registro desta própria exclusão) sobrevive ao grupo que documenta.
-- =====================================================================

create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_group public.groups;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Só o proprietário pode excluir o grupo.'
      using errcode = '42501', hint = 'FTV_NOT_OWNER';
  end if;

  select * into v_group from public.groups where id = p_group_id;

  perform public.write_audit(p_group_id, 'group', p_group_id, 'delete', to_jsonb(v_group), null);

  delete from public.groups where id = p_group_id;
end;
$$;

revoke execute on function public.delete_group(uuid) from public;
grant execute on function public.delete_group(uuid) to authenticated;
