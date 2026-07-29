-- =====================================================================
-- 01 — Esquema base: enums, tabelas, índices e triggers de integridade.
-- =====================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.group_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.match_side as enum ('A', 'B');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.match_status as enum ('confirmed', 'voided');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------

-- Normalização usada para impedir duplicidade acidental de jogadores.
-- Faz trim, colapsa espaços internos e ignora caixa. NÃO remove acentos:
-- "Léo" continua sendo exibido com acento; a comparação é que é insensível
-- a caixa/espaço. IMMUTABLE para poder ser usada em índice.
create or replace function public.normalize_player_name(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

comment on function public.normalize_player_name(text) is
  'Chave de comparação de nomes de jogador: trim + colapso de espaços + lower. Preserva acentos.';

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  avatar_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Cria o profile logo após o cadastro. O único dado aproveitado de
-- raw_user_meta_data é o nome de exibição — nada de papel/permissão vem
-- de metadados controláveis pelo cliente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Jogador'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  timezone text not null default 'America/Sao_Paulo',
  ranking_min_games integer not null default 1 check (ranking_min_games >= 1),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_id_idx on public.group_members (user_id);

-- Um grupo nunca pode ficar sem owner.
create or replace function public.tg_group_requires_owner()
returns trigger
language plpgsql
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

create constraint trigger group_members_requires_owner
  after update or delete on public.group_members
  deferrable initially deferred
  for each row execute function public.tg_group_requires_owner();

-- ---------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  linked_user_id uuid null references auth.users(id) on delete set null,
  display_name text not null check (btrim(display_name) <> ''),
  normalized_name text not null,
  avatar_url text null,
  active boolean not null default true,
  is_guest boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.tg_players_normalize()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.display_name := regexp_replace(btrim(new.display_name), '\s+', ' ', 'g');
  new.normalized_name := public.normalize_player_name(new.display_name);
  return new;
end;
$$;

create trigger players_normalize
  before insert or update of display_name on public.players
  for each row execute function public.tg_players_normalize();

create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.tg_set_updated_at();

-- Jogadores "de verdade" não podem duplicar dentro do grupo. Convidados
-- ficam de fora porque é comum ter dois "João" avulsos em datas diferentes.
create unique index if not exists players_group_normalized_name_key
  on public.players (group_id, normalized_name)
  where is_guest = false;

-- Um usuário está ligado a no máximo um jogador por grupo.
create unique index if not exists players_group_linked_user_key
  on public.players (group_id, linked_user_id)
  where linked_user_id is not null;

create index if not exists players_group_id_idx on public.players (group_id, sort_order, display_name);
create index if not exists players_normalized_name_idx on public.players (group_id, normalized_name);

-- ---------------------------------------------------------------------
-- group_invitations
-- ---------------------------------------------------------------------
create table if not exists public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  code text not null unique check (btrim(code) <> ''),
  role public.group_role not null default 'member',
  expires_at timestamptz null,
  max_uses integer null check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  created_by uuid not null references auth.users(id),
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  -- Um convite comum jamais concede propriedade do grupo.
  constraint group_invitations_role_not_owner check (role <> 'owner')
);

create index if not exists group_invitations_group_id_idx on public.group_invitations (group_id, created_at desc);

-- ---------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  played_on date not null,
  title text null,
  location text null,
  notes text null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.tg_set_updated_at();

create index if not exists sessions_group_played_on_idx on public.sessions (group_id, played_on desc);

-- Uma rodada por data por grupo mantém o lançamento simples e evita
-- sessões duplicadas criadas por dois admins ao mesmo tempo.
create unique index if not exists sessions_group_played_on_key
  on public.sessions (group_id, played_on);

-- ---------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  session_id uuid null references public.sessions(id) on delete set null,
  played_at timestamptz not null,
  winning_side public.match_side not null,
  team_a_score integer null check (team_a_score >= 0),
  team_b_score integer null check (team_b_score >= 0),
  status public.match_status not null default 'confirmed',
  notes text null,
  -- Chave estável de importação: torna o seed legado idempotente.
  external_key text null,
  created_by uuid not null references auth.users(id),
  updated_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by uuid null references auth.users(id),

  -- Ou os dois placares vêm preenchidos, ou nenhum.
  constraint matches_scores_both_or_none
    check ((team_a_score is null) = (team_b_score is null)),
  -- Não existe empate no futevôlei registrado aqui.
  constraint matches_scores_distinct
    check (team_a_score is null or team_a_score <> team_b_score),
  -- Quando há placar, o vencedor é derivado dele.
  constraint matches_winner_matches_score check (
    team_a_score is null
    or (winning_side = 'A' and team_a_score > team_b_score)
    or (winning_side = 'B' and team_b_score > team_a_score)
  )
);

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.tg_set_updated_at();

create index if not exists matches_group_played_at_idx on public.matches (group_id, played_at desc);
create index if not exists matches_session_idx on public.matches (session_id);
create index if not exists matches_group_active_idx
  on public.matches (group_id, played_at desc)
  where status = 'confirmed' and deleted_at is null;

create unique index if not exists matches_group_external_key_key
  on public.matches (group_id, external_key)
  where external_key is not null;

-- ---------------------------------------------------------------------
-- match_players
-- ---------------------------------------------------------------------
create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id),
  side public.match_side not null,
  slot smallint not null check (slot in (1, 2)),
  primary key (match_id, player_id),
  unique (match_id, side, slot)
);

create index if not exists match_players_player_idx on public.match_players (player_id);

-- Validação transacional da composição 2x2. Roda como constraint trigger
-- DEFERRABLE: durante a transação os 4 inserts podem acontecer em qualquer
-- ordem; no COMMIT a partida precisa estar íntegra.
create or replace function public.validate_match_composition(p_match_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_group uuid;
  v_a integer;
  v_b integer;
  v_total integer;
  v_distinct integer;
  v_foreign integer;
begin
  select group_id into v_group from public.matches where id = p_match_id;
  -- Partida removida na mesma transação: nada a validar.
  if v_group is null then
    return;
  end if;

  select
    count(*) filter (where side = 'A'),
    count(*) filter (where side = 'B'),
    count(*),
    count(distinct player_id)
  into v_a, v_b, v_total, v_distinct
  from public.match_players
  where match_id = p_match_id;

  if v_a <> 2 or v_b <> 2 then
    raise exception 'Cada partida precisa de exatamente 2 jogadores por lado (A=%, B=%).', v_a, v_b
      using errcode = 'check_violation';
  end if;

  if v_total <> 4 or v_distinct <> 4 then
    raise exception 'A partida precisa de 4 jogadores distintos.'
      using errcode = 'check_violation';
  end if;

  select count(*)
  into v_foreign
  from public.match_players mp
  join public.players p on p.id = mp.player_id
  where mp.match_id = p_match_id and p.group_id <> v_group;

  if v_foreign > 0 then
    raise exception 'Todos os jogadores precisam pertencer ao grupo da partida.'
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.tg_validate_match_players()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.validate_match_composition(coalesce(new.match_id, old.match_id));
  return null;
end;
$$;

create or replace function public.tg_validate_match_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.validate_match_composition(new.id);
  return null;
end;
$$;

create constraint trigger match_players_composition
  after insert or update or delete on public.match_players
  deferrable initially deferred
  for each row execute function public.tg_validate_match_players();

create constraint trigger matches_composition
  after insert or update on public.matches
  deferrable initially deferred
  for each row execute function public.tg_validate_match_row();

-- ---------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  group_id uuid not null,
  actor_user_id uuid null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_data jsonb null,
  after_data jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_group_created_idx on public.audit_log (group_id, created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
