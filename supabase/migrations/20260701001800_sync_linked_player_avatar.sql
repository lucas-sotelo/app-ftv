-- =====================================================================
-- 18 — Foto do jogador vinculado segue a foto da conta (profiles).
--
-- players.avatar_url e profiles.avatar_url são colunas independentes:
-- um jogador vinculado (linked_user_id) a uma conta não herdava a foto
-- de perfil dessa conta em lugar nenhum do app — o jogador só mostrava
-- foto se alguém tivesse usado o upload específico de jogador (aba
-- Grupo → Jogadores). Resultado visível: o usuário troca a foto em
-- "Perfil", mas o jogador vinculado a ele continua com as iniciais em
-- toda a UI (partidas, ranking, resenha), porque tudo ali lê
-- players.avatar_url, nunca profiles.avatar_url.
--
-- Em vez de fazer COALESCE em cada view/consulta que expõe avatar de
-- jogador (ranking, daily kings, massacres, streaks, match_players,
-- listPlayers...), sincronizamos na origem: players.avatar_url continua
-- sendo a única fonte lida por toda a UI, mas passa a ser preenchida
-- automaticamente a partir de profiles.avatar_url quando o jogador está
-- vinculado e ainda não tem foto própria definida por um admin.
--
-- Não sobrescreve customização: só copia a foto da conta quando o
-- jogador ainda não tem uma foto "fora de sincronia" com a conta (nulo,
-- ou igual ao valor antigo da conta antes da mudança) — a foto que um
-- admin define manualmente para um jogador (linkado ou não) nunca é
-- substituída por trás.
-- =====================================================================

-- Backfill único: conserta agora os jogadores já vinculados que ficaram
-- sem foto (ex.: o jogador "Sotelo" vinculado à própria conta do dono).
update public.players p
set avatar_url = pr.avatar_url
from public.profiles pr
where p.linked_user_id = pr.id
  and p.avatar_url is null
  and pr.avatar_url is not null;

-- Vincular um jogador a uma conta (ou recriá-lo já vinculado) herda a
-- foto da conta na hora, se o jogador ainda não tiver uma.
create or replace function public.tg_player_avatar_from_linked_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.linked_user_id is not null and new.avatar_url is null then
    select avatar_url into new.avatar_url
    from public.profiles
    where id = new.linked_user_id;
  end if;
  return new;
end;
$$;

comment on function public.tg_player_avatar_from_linked_profile() is
  'SECURITY DEFINER: precisa ler profiles de qualquer usuário ao vincular, '
  'independente de quem está editando o jogador.';

revoke execute on function public.tg_player_avatar_from_linked_profile() from public, authenticated, anon;

drop trigger if exists trg_player_avatar_from_linked_profile on public.players;
create trigger trg_player_avatar_from_linked_profile
  before insert or update of linked_user_id, avatar_url on public.players
  for each row execute function public.tg_player_avatar_from_linked_profile();

-- Trocar a foto da conta propaga para os jogadores vinculados que ainda
-- estavam "em sincronia" com ela (nulo ou igual à foto antiga).
create or replace function public.tg_propagate_profile_avatar_to_players()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.avatar_url is distinct from old.avatar_url then
    update public.players
    set avatar_url = new.avatar_url
    where linked_user_id = new.id
      and avatar_url is not distinct from old.avatar_url;
  end if;
  return new;
end;
$$;

comment on function public.tg_propagate_profile_avatar_to_players() is
  'SECURITY DEFINER: precisa atualizar players em qualquer grupo em que o '
  'usuário tenha um jogador vinculado, ignorando a RLS de "admin só edita '
  'jogador do próprio grupo" — aqui é o dono da conta editando a si mesmo.';

revoke execute on function public.tg_propagate_profile_avatar_to_players() from public, authenticated, anon;

drop trigger if exists trg_propagate_profile_avatar_to_players on public.profiles;
create trigger trg_propagate_profile_avatar_to_players
  after update of avatar_url on public.profiles
  for each row execute function public.tg_propagate_profile_avatar_to_players();
