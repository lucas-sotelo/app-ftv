-- =====================================================================
-- 02 — Funções de autorização e políticas de RLS.
--
-- Regra do projeto: a interface pode esconder botões, mas a autorização
-- de verdade vive aqui. Trocar um UUID na URL não pode dar acesso a nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de autorização
--
-- SECURITY DEFINER de propósito: as políticas de group_members precisam
-- consultar group_members, o que causaria recursão infinita se a função
-- rodasse sob RLS. search_path é fixado e o EXECUTE é restrito.
-- ---------------------------------------------------------------------
create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = (select auth.uid())
      and gm.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = (select auth.uid())
      and gm.role = 'owner'
  );
$$;

-- Dois usuários "se enxergam" apenas se dividem ao menos um grupo.
create or replace function public.shares_group_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = target_user_id
  );
$$;

-- Papel do usuário atual no grupo (null se não for membro). Usado pela UI.
create or replace function public.current_group_role(target_group_id uuid)
returns public.group_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select gm.role
  from public.group_members gm
  where gm.group_id = target_group_id
    and gm.user_id = (select auth.uid());
$$;

revoke execute on function public.is_group_member(uuid) from public;
revoke execute on function public.is_group_admin(uuid) from public;
revoke execute on function public.is_group_owner(uuid) from public;
revoke execute on function public.shares_group_with(uuid) from public;
revoke execute on function public.current_group_role(uuid) from public;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;
grant execute on function public.current_group_role(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS ligado em tudo que é exposto pela API
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.players enable row level security;
alter table public.group_invitations enable row level security;
alter table public.sessions enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- A tabela só guarda display_name/avatar_url — exatamente os campos que
-- outro membro do grupo precisa ver. Não há dado sensível a filtrar por
-- coluna. E-mail e demais dados ficam em auth.users, que não é exposto.
-- ---------------------------------------------------------------------
create policy "profiles: leitura própria ou de colegas de grupo"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));

create policy "profiles: cria o próprio"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles: edita o próprio"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------
create policy "groups: só os grupos de que participo"
  on public.groups for select to authenticated
  using (public.is_group_member(id));

create policy "groups: qualquer autenticado cria o próprio grupo"
  on public.groups for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "groups: owner/admin editam"
  on public.groups for update to authenticated
  using (public.is_group_admin(id))
  with check (public.is_group_admin(id));

create policy "groups: só owner apaga"
  on public.groups for delete to authenticated
  using (public.is_group_owner(id));

-- ---------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------
create policy "membros: leitura pelos membros do grupo"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

create policy "membros: admin adiciona não-owner"
  on public.group_members for insert to authenticated
  with check (public.is_group_admin(group_id) and role <> 'owner');

-- USING avalia a linha antiga, WITH CHECK a nova. Juntas garantem que
-- admin não mexe em owner nem promove ninguém a owner.
create policy "membros: admin altera papéis não-owner"
  on public.group_members for update to authenticated
  using (public.is_group_admin(group_id) and (role <> 'owner' or public.is_group_owner(group_id)))
  with check (public.is_group_admin(group_id) and (role <> 'owner' or public.is_group_owner(group_id)));

create policy "membros: sair do grupo ou admin remover não-owner"
  on public.group_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (public.is_group_admin(group_id) and (role <> 'owner' or public.is_group_owner(group_id)))
  );

-- ---------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------
create policy "jogadores: leitura pelos membros"
  on public.players for select to authenticated
  using (public.is_group_member(group_id));

create policy "jogadores: owner/admin criam"
  on public.players for insert to authenticated
  with check (public.is_group_admin(group_id) and created_by = (select auth.uid()));

create policy "jogadores: owner/admin editam"
  on public.players for update to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy "jogadores: owner/admin apagam"
  on public.players for delete to authenticated
  using (public.is_group_admin(group_id));

-- ---------------------------------------------------------------------
-- group_invitations
-- Membro comum não lista códigos de convite; o resgate é feito pela RPC
-- redeem_group_invitation, que roda como SECURITY DEFINER.
-- ---------------------------------------------------------------------
create policy "convites: leitura por owner/admin"
  on public.group_invitations for select to authenticated
  using (public.is_group_admin(group_id));

create policy "convites: owner/admin criam"
  on public.group_invitations for insert to authenticated
  with check (
    public.is_group_admin(group_id)
    and created_by = (select auth.uid())
    and role <> 'owner'
  );

create policy "convites: owner/admin revogam"
  on public.group_invitations for update to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id) and role <> 'owner');

-- ---------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------
create policy "sessões: leitura pelos membros"
  on public.sessions for select to authenticated
  using (public.is_group_member(group_id));

create policy "sessões: owner/admin criam"
  on public.sessions for insert to authenticated
  with check (public.is_group_admin(group_id) and created_by = (select auth.uid()));

create policy "sessões: owner/admin editam"
  on public.sessions for update to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy "sessões: owner/admin apagam"
  on public.sessions for delete to authenticated
  using (public.is_group_admin(group_id));

-- ---------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------
create policy "partidas: leitura pelos membros"
  on public.matches for select to authenticated
  using (public.is_group_member(group_id));

create policy "partidas: owner/admin registram"
  on public.matches for insert to authenticated
  with check (public.is_group_admin(group_id) and created_by = (select auth.uid()));

create policy "partidas: owner/admin editam"
  on public.matches for update to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy "partidas: owner/admin apagam"
  on public.matches for delete to authenticated
  using (public.is_group_admin(group_id));

-- ---------------------------------------------------------------------
-- match_players
-- ---------------------------------------------------------------------
create policy "escalação: leitura pelos membros"
  on public.match_players for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and public.is_group_member(m.group_id)
    )
  );

create policy "escalação: owner/admin inserem"
  on public.match_players for insert to authenticated
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id and public.is_group_admin(m.group_id)
    )
  );

create policy "escalação: owner/admin editam"
  on public.match_players for update to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and public.is_group_admin(m.group_id)
    )
  )
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id and public.is_group_admin(m.group_id)
    )
  );

create policy "escalação: owner/admin removem"
  on public.match_players for delete to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and public.is_group_admin(m.group_id)
    )
  );

-- ---------------------------------------------------------------------
-- audit_log
-- Somente leitura, e apenas para quem administra o grupo. A escrita
-- acontece exclusivamente pela função write_audit (SECURITY DEFINER).
-- ---------------------------------------------------------------------
create policy "auditoria: leitura por owner/admin"
  on public.audit_log for select to authenticated
  using (public.is_group_admin(group_id));

revoke insert, update, delete on public.audit_log from anon, authenticated;
