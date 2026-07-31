-- =====================================================================
-- 19 — Limpeza de grupos de teste duplicados ("Pelada SQB").
--
-- Confirmado com o dono da conta: os grupos abaixo não são uma
-- duplicidade de dado real — são resultado de rodar o fluxo de
-- criação de grupo + importação legada várias vezes durante testes,
-- cada execução criando um grupo `groups` novo e distinto (cada um com
-- as mesmas 39 partidas legadas). Não é um bug de group_members: cada
-- grupo aqui tem seu próprio id, então não há nada para "desduplicar"
-- na tabela de membros — precisa apagar as linhas de groups mesmo.
--
-- Mantém 1 grupo por nome duplicado (o mais antigo, por created_at —
-- o mais provável de ser o "original"). Os demais são apagados, e
-- players/matches/group_members/convites daquele grupo somem junto via
-- "on delete cascade" (já declarado desde o schema base).
--
-- Escopo deliberadamente restrito ao nome exato visto no bug reportado
-- — não é uma limpeza genérica de "grupos com nome repetido", para não
-- arriscar apagar grupos de outros donos que coincidentemente
-- compartilhem nome.
-- =====================================================================

with ranked as (
  select
    id,
    row_number() over (order by created_at asc) as rn
  from public.groups
  where name = 'Pelada SQB'
)
delete from public.groups
where id in (select id from ranked where rn > 1);
