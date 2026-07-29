-- =====================================================================
-- Seed local (supabase db reset).
--
-- Não há dado de produção aqui de propósito: usuários vêm do Supabase Auth
-- e o histórico legado entra pelo script idempotente
--   npm run import:legacy -- --group <GROUP_ID>
-- que lê data/futevolei-legacy-seed.json.
--
-- Este arquivo existe para deixar explícito que o banco nasce vazio e que
-- as migrations reproduzem o esquema do zero.
-- =====================================================================

select 'banco pronto — nenhum dado semeado' as status;
