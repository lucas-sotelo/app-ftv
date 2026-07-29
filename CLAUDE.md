@AGENTS.md

# Futevôlei & Beach Tênis PWA — Diretrizes Operacionais do Projeto

## 1. Comandos de Validação e Testes
- **Unitários (Lógica & Estatísticas):** `npm test` (Rode SEMPRE após mexer em `lib/stats/`, regras de pontuação ou desempate).
- **Tipo e Lint:** `npm run typecheck` e `npm run lint`.
- **E2E e PWA:** `npm run test:e2e` (Valida fluxo e tela 360px mobile-first).
- **Banco de Dados:** `npm run db:reset` (Docker local) ou `npm run db:push` (Supabase Cloud).

## 2. Arquitetura & Invariantes do Sistema (NÃO VIOLAR)
- **Cálculo no Banco (Zero Client-Side Math):** Todas as estatísticas (individuais, duplas, H2H) vêm processadas do Postgres (Views/RPCs). Nunca calcule médias, rankings ou vitórias no navegador.
- **Identidade de Duplas:** Duplas são dinâmicas e identificadas canonicamente por UUID via chave `LEAST(id1, id2) || '_' || GREATEST(id1, id2)`. Nomes (`normalized_name`) servem apenas para evitar duplicidade no cadastro, nunca como chave relacional.
- **Transações Atômicas:** Partidas SÓ são criadas/editadas via RPCs transacionais (`create_match`/`update_match`). Nunca faça `supabase.from('matches').insert()` direto pelo front-end.
- **Sem Sincronização Otimista Offline:** Para escrita (registrar/anular partida), o PWA exige conexão. Se offline, desabilite o formulário com aviso visual claro. Nunca finja que os dados foram salvos.
- **Timezone Estrito:** Todo recorte de datas e períodos deve respeitar o timezone do grupo (`groups.timezone`, default `America/Sao_Paulo`), utilizando `date-fns` + `@date-fns/tz`.

## 3. Regras para Economia de Tokens e Foco de Escopo
- **Ignorar Dados Pesados:** NUNCA leia ou procure conteúdo em `data/futevolei-legacy-seed.json` (39 partidas legadas) a menos que explicitamente ordenado.
- **Isolamento UI vs. DB:** Ao criar ou corrigir layouts em Tailwind CSS v4 / shadcn/ui, NÃO inspecione arquivos de migration (`supabase/migrations/*`) ou lógicas de RLS.
- **Permissões de UI:** Para ocultar elementos administrativos de quem tem papel `Member`, utilize sempre os utilitários de `lib/permissions`, lembrando que a segurança real está no RLS do banco.
- **Mobile-First Strict:** Garanta que qualquer novo componente ou layout não gere overflow horizontal em viewports de **360px de largura**.