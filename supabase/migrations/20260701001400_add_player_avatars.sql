-- =====================================================================
-- 14 — Fotos de perfil dos jogadores.
--
-- players.avatar_url já existe desde o schema base (init_schema.sql).
-- Falta só o Storage: bucket público `avatars`, path `{group_id}/...`,
-- mesmo padrão de supabase/migrations/20260701000600 (bucket
-- `group-avatars`). Leitura é pública (miniaturas aparecem sem sessão);
-- escrita exige autenticação E pertencer ao grupo da pasta — qualquer
-- membro pode subir/trocar a foto de um jogador do próprio grupo (não só
-- admin, ao contrário do avatar do grupo em si).
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars: leitura pública"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: membros enviam"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

create policy "avatars: membros atualizam"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'avatars'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

create policy "avatars: membros apagam"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );
