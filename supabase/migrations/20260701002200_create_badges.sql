-- =====================================================================
-- 22 — Badges (conquistas): infraestrutura visual e de banco.
--
-- Primeira etapa do sistema de engajamento por conquistas: schema, RLS e
-- seed das 3 primeiras badges. A detecção automática (5 vitórias
-- seguidas, 3 derrotas seguidas pro mesmo adversário, virada de 5 pontos)
-- fica para uma etapa futura — por isso não existe nenhuma policy de
-- escrita para `authenticated` em player_badges: só o servidor concede,
-- do mesmo jeito que audit_log só é escrito via write_audit.
-- =====================================================================

-- ---------------------------------------------------------------------
-- badges: catálogo global, não é por grupo.
-- ---------------------------------------------------------------------
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text not null,
  icon text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- player_badges: M:N entre players e badges. group_id é denormalizado de
-- propósito (mesmo player nunca troca de grupo) para permitir RLS e
-- índice sem precisar de join em toda leitura.
-- ---------------------------------------------------------------------
create table if not exists public.player_badges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  match_id uuid references public.matches (id) on delete set null,
  awarded_at timestamptz not null default now()
);

create index if not exists player_badges_group_player_idx
  on public.player_badges (group_id, player_id);
create index if not exists player_badges_badge_idx
  on public.player_badges (badge_id);

alter table public.badges enable row level security;
alter table public.player_badges enable row level security;

-- badges é catálogo de referência: qualquer autenticado lê.
create policy "badges: leitura por qualquer autenticado"
  on public.badges for select to authenticated
  using (true);

-- player_badges: leitura só pelos membros do grupo. Sem policy de
-- insert/update/delete para authenticated — concessão é responsabilidade
-- exclusiva de uma futura rotina do servidor.
create policy "conquistas: leitura pelos membros do grupo"
  on public.player_badges for select to authenticated
  using (public.is_group_member(group_id));

revoke insert, update, delete on public.badges from anon, authenticated;
revoke insert, update, delete on public.player_badges from anon, authenticated;

-- ---------------------------------------------------------------------
-- Seed: as 3 primeiras conquistas.
-- ---------------------------------------------------------------------
insert into public.badges (key, label, description, icon)
values
  ('carrasco', 'Carrasco', 'Venceu 5 partidas seguidas.', '🗡️'),
  ('fregues', 'Freguês', 'Perdeu 3 partidas seguidas para o mesmo adversário.', '💸'),
  ('inabalavel', 'Inabalável', 'Venceu uma partida estando 5 pontos atrás.', '🧱')
on conflict (key) do nothing;
