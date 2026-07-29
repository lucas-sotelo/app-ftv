# Futevôlei — organização e estatísticas

PWA mobile-first para grupos privados de futevôlei: cadastro de jogadores, registro de partidas
2x2, e estatísticas individuais, de duplas e de confrontos diretos — substituindo a planilha que o
grupo usava hoje.

## 1. Visão geral do produto

- Vários grupos privados por usuário, com convite por código/link.
- Papéis por grupo: proprietário, administrador e membro.
- Jogadores cadastrados no grupo (inclusive convidados sem conta no app), identificados por UUID
  — nunca por nome — para eliminar duplicidade por acento/espaço/caixa.
- Partidas 2x2 com placar opcional; quando não há placar, o administrador escolhe o vencedor.
- Exclusão lógica e anulação de partidas, com trilha de auditoria.
- Estatísticas calculadas no Postgres (nunca no navegador): individual, duplas, confronto
  jogador x jogador e confronto dupla x dupla, com filtros de período/jogador/rodada refletidos na
  URL.
- Instalável como PWA (Android/iOS/desktop), com aviso de nova versão e bloqueio claro de escrita
  offline (nada finge estar sincronizado).

## 2. Stack

- Next.js 16 (App Router) + React 19 + TypeScript `strict`.
- Tailwind CSS v4 + componentes no estilo shadcn/ui (Radix UI primitives).
- Supabase: Auth, Postgres, Realtime.
- Zod (validação compartilhada) + React Hook Form.
- date-fns + `@date-fns/tz`, locale `pt-BR`, timezone padrão `America/Sao_Paulo`.
- Vitest (unitários) e Playwright (E2E).
- Deploy na Vercel.

## 3. Pré-requisitos

- Node.js 20+ e npm.
- Uma conta e um projeto no [Supabase](https://supabase.com).
- Opcional, mas recomendado para desenvolvimento local e para rodar os testes de
  integração/E2E completos: [Docker](https://www.docker.com/) + [Supabase CLI](https://supabase.com/docs/guides/cli)
  (`npx supabase`, sem precisar instalar globalmente).

## 4. Configuração do Supabase

### 4.1 Projeto na nuvem

1. Crie um projeto em [supabase.com](https://supabase.com/dashboard).
2. Em **Project Settings → API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / `publishable` key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (fica só no servidor/scripts, nunca no
     navegador)
3. Em **Authentication → URL Configuration**, adicione `http://localhost:3000/auth/callback` (e a
   URL de produção depois do deploy) às Redirect URLs.
4. Em **Authentication → Providers → Email**, deixe a confirmação de e-mail ligada em produção. Em
   desenvolvimento local isso já vem desligado em `supabase/config.toml`.

### 4.2 Ambiente local (opcional, requer Docker)

```bash
npx supabase login
npx supabase link --project-ref <seu-project-ref>
npx supabase start
```

Isso sobe Postgres, Auth, Realtime e o Studio localmente, nas portas definidas em
`supabase/config.toml`.

## 5. Aplicação das migrations

As migrations em `supabase/migrations/` são numeradas e reproduzem o banco do zero:

1. `20260701000000_init_schema.sql` — enums, tabelas, índices, triggers de integridade
   (normalização de nome, `updated_at`, invariante "grupo sempre tem owner", validação 2x2 da
   partida).
2. `20260701000100_authz_and_rls.sql` — funções de autorização (`is_group_member`,
   `is_group_admin`, `is_group_owner`) e todas as políticas de RLS.
3. `20260701000200_rpc.sql` — operações transacionais: `create_group_with_owner`,
   `redeem_group_invitation`, `create_match`, `update_match`, `void_match`, `delete_match`,
   `restore_match`, `set_member_role`, convites, sessões.
4. `20260701000300_stats.sql` — views e funções de leitura das estatísticas
   (`stats_players`, `stats_pairs`, `stats_player_head_to_head`, `stats_pair_head_to_head`,
   `group_overview`).
5. `20260701000400_realtime.sql` — publica `matches`, `match_players`, `players` e `sessions` no
   Realtime.

Para aplicar:

```bash
# ambiente local com Docker
npm run db:reset

# projeto Supabase na nuvem (depois de `supabase link`)
npm run db:push
```

> **Importante:** este projeto foi desenvolvido num ambiente sem Docker/Postgres disponível para
> execução, então as migrations foram escritas e revisadas com cuidado, mas **não foram
> executadas de fato contra um Postgres real** nesta entrega. Rode `npm run db:reset` (ou
> `db:push` num projeto de teste) antes de ir para produção — é o primeiro passo do checklist de
> deploy. Veja a seção 15 (Limitações).

## 6. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: as únicas duas que chegam ao
  navegador. Toda autorização real está na RLS, não nessas chaves.
- `SUPABASE_SERVICE_ROLE_KEY`: só é lida em `lib/supabase/admin.ts` (marcado `server-only`) e no
  script de importação. Nunca a exponha com prefixo `NEXT_PUBLIC_`.
- `GROUP_ID`: opcional, só para o script de importação (pode ser passado por `--group` também).

## 7. Execução local

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Sem grupo, você cai em `/comecar` para criar um ou entrar com um
convite.

## 8. Testes

### 8.1 Unitários (`npm test` / `npm run test:unit`)

Não dependem de banco. Cobrem:

- Identidade canônica de dupla (independe da ordem).
- Validação de escalação (4 jogadores distintos) e de placar/vencedor.
- Cálculo individual, de duplas, confronto jogador x jogador e dupla x dupla — inclusive que
  parceiros de dupla nunca contam como confronto entre si.
- Período/timezone (ano atual, mês atual, intervalo personalizado, todos em `America/Sao_Paulo`).
- Critérios de desempate do ranking.
- **Fixture com as 39 partidas legadas**, comparando byte a byte com os números da planilha
  (`lib/legacy/expected.ts`) — ranking individual, as 18 duplas e os 6 confrontos de referência da
  seção 9 do briefing. Qualquer mudança nas regras de cálculo que altere esses números quebra o
  teste.

```bash
npm test
```

Rode também `npm run verify:legacy` para ver a mesma verificação em formato de relatório no
terminal (útil para conferir visualmente contra a planilha).

### 8.2 Integração (`npm run test:integration`)

Batem contra um Supabase de verdade — **nunca aponte para produção**, os testes criam e apagam
dados. Suba um ambiente local:

```bash
npx supabase start
npm run db:reset
cp .env.local .env.test.local   # ajuste se as chaves locais forem diferentes
npm run test:integration
```

Cobrem, direto no banco (não na interface):

- Isolamento entre grupos (um usuário não lê nem lista dados de outro grupo, nem forçando o UUID).
- Member não cria/edita/exclui partida nem jogador; admin consegue.
- Jogador inativo não entra em partida nova, mas permanece no histórico.
- Partida anulada e exclusão lógica saem das estatísticas e a exclusão continua na auditoria.
- Convite revogado/expirado falha; convite nunca concede `owner`.
- Grupo nunca fica sem `owner`; admin não promove ninguém a `owner`.
- Paridade completa das **funções SQL de estatística** com os números da planilha (importa as 39
  partidas pela mesma RPC do app e confere ranking, duplas e confrontos de referência) — é o mesmo
  contrato do teste unitário, mas provando que o Postgres, e não só o oráculo em TypeScript,
  produz os números certos.

### 8.3 E2E (`npm run test:e2e`)

```bash
npm run test:e2e:install   # baixa o Chromium do Playwright, uma vez
npm run build && npm run start &   # ou deixe o Playwright subir sozinho (ver playwright.config.ts)
npm run test:e2e
```

Por padrão o Playwright sobe `next build && next start` e roda em dois projetos (`mobile`, viewport
360px, e `desktop`). Precisa de `NEXT_PUBLIC_SUPABASE_*` válidas — os testes de fluxo principal
criam contas de teste de verdade (`ftv-e2e-*@example.test`) via `/criar-conta`.

Fluxo coberto (`tests/e2e/fluxo-principal.spec.ts`):

1. Criar conta e grupo.
2. Cadastrar quatro jogadores.
3. Registrar partida sem placar (com bloqueio de jogador repetido em tempo real).
4. Registrar partida com placar (vencedor derivado automaticamente).
5. Ver estatísticas atualizadas (individual, duplas, confrontos), com filtros na URL.
6. Gerar convite.
7. Convidado entra pelo código e consegue ler partidas/estatísticas.
8. Member tenta ação administrativa (registrar partida, cadastrar jogador) e é bloqueado tanto na
   interface quanto ao forçar a URL — porque o servidor e a RLS recusam, não só o botão escondido.

`tests/e2e/pwa.spec.ts` cobre manifest, ícones, service worker sem cache, página offline e
ausência de overflow horizontal em 360px — **este arquivo já rodou nesta entrega**, contra um
`next build && next start` real (ver seção 15).

## 9. Importação da planilha legada

O arquivo `data/futevolei-legacy-seed.json` já contém as 39 partidas descritas no briefing,
distribuídas nas seis datas e reproduzindo exatamente os números da seção 9 (conferido por
`npm run verify:legacy`, sem precisar de banco).

Para importar num grupo real:

```bash
# 1. Crie o grupo pela interface (ou pela RPC create_group_with_owner) e copie o ID.
# 2. Rode o script (usa a service_role — nunca rode isso no navegador):
npm run import:legacy -- --group <GROUP_ID>

# Simulação, sem gravar nada:
npm run import:legacy -- --group <GROUP_ID> --dry-run
```

O script (`scripts/import-legacy-data.ts`):

- É **idempotente**: cada partida recebe uma chave estável (`matches.external_key`, hash de
  data + nomes normalizados + ocorrência). Rodar de novo não duplica nada.
- Cria ou reaproveita jogadores pelo nome normalizado, cria uma sessão por data, importa as
  partidas sem placar numérico (a planilha não guardava pontos) e, ao final, roda a mesma
  verificação de `verify:legacy` **direto no banco**, comparando o ranking individual e as 18
  duplas com a seção 9 e falhando (`exit 1`) se algo divergir.

## 10. Deploy na Vercel

1. Suba o repositório para o GitHub/GitLab.
2. Na Vercel, importe o projeto (framework Next.js é detectado automaticamente).
3. Em **Settings → Environment Variables**, configure:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (a URL de produção, ex. `https://seu-app.vercel.app`)
   - `SUPABASE_SERVICE_ROLE_KEY` — **apenas se você for rodar o script de importação por uma Vercel
     CLI/CI**; não é necessária para o app em si, que nunca a usa no runtime público.
4. Aplique as migrations no projeto Supabase de produção (`npm run db:push`, com `supabase link`
   apontando para ele) **antes** do primeiro deploy.
5. Em **Authentication → URL Configuration** no Supabase, adicione
   `https://seu-app.vercel.app/auth/callback` às Redirect URLs.
6. Deploy. O `next.config.ts` já cuida dos headers de cache do service worker e do manifest.

## 11. Modelo de permissões

| Ação                                            | Owner | Admin | Member |
| ----------------------------------------------- | ----- | ----- | ------ |
| Ler partidas, estatísticas, jogadores           | ✅    | ✅    | ✅     |
| Criar/editar/anular/excluir partida             | ✅    | ✅    | ❌     |
| Criar/editar/desativar jogador                  | ✅    | ✅    | ❌     |
| Criar/revogar convite                           | ✅    | ✅    | ❌     |
| Promover/rebaixar admin                         | ✅    | ✅    | ❌     |
| Promover/rebaixar owner, transferir propriedade | ✅    | ❌    | ❌     |
| Editar configurações do grupo                   | ✅    | ✅    | ❌     |
| Editar o próprio perfil                         | ✅    | ✅    | ✅     |

Tudo isso está implementado em duas camadas independentes:

- **Interface**: esconde botões/rotas que o papel atual não usa (`lib/permissions`), e as páginas
  Server Component redirecionam quem tenta acessar uma rota administrativa sem permissão.
- **Banco (a fonte de verdade)**: RLS em todas as tabelas + as funções `is_group_member`,
  `is_group_admin`, `is_group_owner`, mais as regras dentro de cada RPC transacional. Trocar um
  UUID na URL ou chamar a API diretamente não contorna nada — os testes de integração provam isso
  contra o banco real, não contra a interface.

## 12. Decisões de arquitetura e limitações do MVP

- **Duplas nunca são uma lista manual.** São calculadas dinamicamente a partir de
  `match_players`, com chave canônica (`LEAST/GREATEST` de dois UUIDs), tanto no Postgres quanto no
  oráculo TypeScript usado nos testes.
- **Nome nunca é chave de negócio.** `players.normalized_name` só existe para impedir duplicidade
  acidental (trim + colapso de espaço + case-insensitive, preservando acentos); os cálculos usam
  sempre `player_id`.
- **Uma partida é sempre gravada por uma RPC transacional** (`create_match`/`update_match`), nunca
  por vários inserts soltos do navegador — evita partida "pela metade" e condições de corrida.
  Como cinto de segurança extra, uma constraint trigger `DEFERRABLE INITIALLY DEFERRED` valida a
  composição 2x2 no `COMMIT`, mesmo que algo escreva direto na tabela.
- **Exclusão é sempre lógica.** `matches.deleted_at`/`deleted_by` preservam o registro para
  auditoria; as estatísticas (`v_valid_matches`) ignoram `deleted_at is not null` e
  `status = 'voided'`.
- **Timezone do grupo, não do navegador.** Todo recorte de período (ano atual, mês atual,
  intervalo) é calculado no fuso salvo em `groups.timezone` (`America/Sao_Paulo` por padrão), para
  o "mês atual" bater com o calendário de quem joga, não com o fuso do celular de quem consulta.
- **PWA sem sincronização otimista de escrita.** No MVP, registrar partida exige conexão; o
  formulário fica desabilitado offline com aviso explícito — evita a pior experiência possível
  (achar que salvou e não ter salvo).
- **Sem transferência de propriedade na interface ainda.** `set_member_role` no banco já suporta
  promover alguém a `owner` (só outro `owner` pode chamá-la), mas a tela de administração do grupo
  não expõe um fluxo dedicado de "transferir propriedade e sair" — hoje um owner promove outro
  owner manualmente pela lista de membros.
- **Convite é só link/código**, sem e-mail transacional embutido (fica a critério de cada grupo
  mandar o link por onde preferir).

## 13. Estrutura do projeto

```text
app/
  (auth)/                 entrar, criar-conta, recuperar/nova senha
  auth/callback/           troca o code do e-mail por sessão
  comecar/                 onboarding: criar grupo ou entrar por convite
  convite/[code]/          link curto de convite
  [groupSlug]/              área do grupo (nav inferior: início, partidas, estatísticas, grupo, perfil)
    partidas/nova, [matchId]/editar
    estatisticas/
    jogadores/[playerId]/, duplas/[pairKey]/
    grupo/, grupo/jogadores/, grupo/auditoria/
    perfil/
components/
  ui/                      primitivos (button, card, select, dialog, tabs...)
  matches/, stats/, groups/, players/, filters/, layout/, pwa/, realtime/, profile/
lib/
  supabase/                clients (browser/server/admin), tipos do banco, tradução de erros
  actions/                 Server Actions (auth, groups, players, matches)
  data/                    leitura tipada (groups, players, matches, stats)
  stats/                   domain.ts (oráculo TS), filters.ts (URL), sort.ts
  permissions/             espelho do modelo de RLS para a interface
  validations/              schemas Zod compartilhados
  legacy/                   dataset + números de referência da planilha
  utils/                   formatação pt-BR, período, fuso, cn()
supabase/
  migrations/               5 arquivos numerados, do zero ao banco completo
  config.toml, seed.sql
scripts/
  import-legacy-data.ts, verify-legacy-dataset.ts, generate-icons.mjs
data/
  futevolei-legacy-seed.json
tests/
  unit/, integration/, e2e/
```

## 14. Critérios de aceite — status

- `npm run lint` — ✅ sem erros.
- `npm run typecheck` — ✅ sem erros.
- `npm test` (unitários) — ✅ 109 testes aprovados, incluindo a fixture das 39 partidas.
- `npm run build` — ✅ aprovado (Next 16, Turbopack).
- `npm run test:e2e` — configuração documentada; a suíte de PWA/manifest/offline/360px rodou de
  verdade nesta entrega contra um build real. A suíte de fluxo principal (login → grupo →
  partidas → estatísticas → convite → bloqueio de member) está escrita e pronta, mas depende de um
  Supabase acessível — rode-a antes do deploy (seção 8.3).
- `npm run test:integration` — escrita e documentada; não rodou nesta entrega por falta de
  Docker/Postgres no ambiente de desenvolvimento (seção 15).
- Nenhuma chave secreta versionada (`.env.local`/`.env.test.local` estão no `.gitignore`; só
  `.env.example` com placeholders é versionado).
- Migrations reproduzem o banco do zero, em ordem (seção 5) — ainda não executadas de fato
  (seção 15).
- Estatísticas do seed batem exatamente com a seção 9 do briefing — provado pelo teste unitário
  `tests/unit/legacy-parity.test.ts` e por `npm run verify:legacy`.
- 360px sem overflow horizontal — testado via Playwright (`tests/e2e/pwa.spec.ts`).
- PWA: manifest completo (ícone maskable incluso), service worker sem cache, página offline —
  testado via Playwright contra um build real.

## 15. Limitações reais desta entrega

O ambiente onde este projeto foi construído **não tinha Docker nem um Postgres disponível**. Isso
teve duas consequências concretas, que ficam como próximo passo antes de ir para produção:

1. **As migrations nunca rodaram contra um Postgres de verdade.** Foram escritas e revisadas
   manualmente com cuidado (inclusive a equivalência entre a ordenação lexicográfica de UUID em
   texto usada no TypeScript e a ordenação binária usada nas comparações de UUID no Postgres, que
   garante que a chave canônica de dupla seja idêntica nas duas camadas), mas só `npm run db:reset`
   num ambiente com Docker (ou `db:push` num projeto Supabase de teste) confirma que não há erro
   de sintaxe ou de lógica que só aparece em execução.
2. **Os testes de integração (`tests/integration/`) e o teste E2E de fluxo principal
   (`tests/e2e/fluxo-principal.spec.ts`) não foram executados.** Estão escritos, tipados e
   revisados, cobrindo exatamente os cenários pedidos na seção 16 do briefing (isolamento entre
   grupos, permissões, jogador inativo, exclusão lógica, convite expirado/revogado, paridade da
   planilha no banco), mas precisam rodar contra um Supabase real antes de você confiar neles.

O que **foi** executado e validado nesta entrega: `npm run lint`, `npm run typecheck`, `npm test`
(109 testes unitários, incluindo a paridade completa com a planilha), `npm run build`, e a suíte
`tests/e2e/pwa.spec.ts` contra um `next build && next start` real.

Antes de considerar isso pronto para produção: rode `npx supabase start && npm run db:reset`,
depois `npm run test:integration` e `npm run test:e2e` na íntegra, e só então `npm run
import:legacy` num grupo de teste para conferir a importação ponta a ponta.
