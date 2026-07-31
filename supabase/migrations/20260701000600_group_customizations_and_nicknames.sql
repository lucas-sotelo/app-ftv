-- =====================================================================
-- 06 — Apelido de jogador, emojis de destaque e avatar do grupo.
-- =====================================================================
-- Campos puramente de apresentação: não entram em nenhum cálculo de
-- estatística (que continua 100% no Postgres via views/RPCs existentes).

-- ---------------------------------------------------------------------
-- players.nickname
-- ---------------------------------------------------------------------
alter table public.players
  add column if not exists nickname text null;

alter table public.players
  add constraint players_nickname_not_blank
    check (nickname is null or btrim(nickname) <> '');

-- A unicidade continua em normalized_name (display_name); nickname é só
-- exibição e nunca participa de identidade relacional.

-- ---------------------------------------------------------------------
-- groups.first_place_emoji / last_place_emoji / avatar_url
-- ---------------------------------------------------------------------
alter table public.groups
  add column if not exists first_place_emoji text null default '👑';

alter table public.groups
  add column if not exists last_place_emoji text null default '🐢';

alter table public.groups
  add column if not exists avatar_url text null;

-- As policies de RLS existentes em `groups` e `players` (ver
-- 20260701000100_authz_and_rls.sql) operam por linha, não por coluna —
-- membros já leem e owner/admin já editam essas tabelas inteiras, então as
-- novas colunas herdam a mesma leitura/escrita sem policy adicional.

-- ---------------------------------------------------------------------
-- storage: bucket group-avatars
--
-- Convenção de path: `{group_id}/{arquivo}` — é o que permite às políticas
-- abaixo checar o grupo sem tabela extra, via storage.foldername(name).
-- Bucket público para leitura (miniaturas aparecem sem sessão autenticada
-- em contextos como PWA install/share); escrita continua restrita a
-- owner/admin do grupo, mesma regra de `groups: owner/admin editam`.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('group-avatars', 'group-avatars', true)
on conflict (id) do nothing;

create policy "group-avatars: leitura pública"
  on storage.objects for select
  using (bucket_id = 'group-avatars');

create policy "group-avatars: owner/admin enviam"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'group-avatars'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "group-avatars: owner/admin atualizam"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'group-avatars'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'group-avatars'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "group-avatars: owner/admin apagam"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'group-avatars'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid)
  );
