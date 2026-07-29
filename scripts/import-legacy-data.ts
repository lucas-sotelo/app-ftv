/**
 * Importa a planilha legada (data/futevolei-legacy-seed.json) para um grupo.
 *
 *   npm run import:legacy -- --group <GROUP_ID>
 *   GROUP_ID=... npm run import:legacy
 *   npm run import:legacy -- --group <GROUP_ID> --dry-run
 *
 * É idempotente: cada partida recebe uma chave estável em `matches.external_key`
 * derivada de data + nomes + ocorrência. Rodar duas vezes não duplica nada.
 *
 * Usa a service_role, então SÓ pode rodar em ambiente seguro (sua máquina ou
 * um job de deploy) — nunca no navegador.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import {
  legacyDates,
  legacyExternalKey,
  legacyPlayerNames,
  withOccurrences,
  type LegacyDataset,
} from "../lib/legacy/dataset";
import {
  EXPECTED_PAIR_RANKING,
  EXPECTED_PLAYER_RANKING,
  EXPECTED_SESSIONS,
  EXPECTED_TOTAL_MATCHES,
} from "../lib/legacy/expected";
import type { Database } from "../lib/supabase/database.types";
import { formatPercentPrecise } from "../lib/utils/format";
import { normalizePlayerName } from "../lib/validations/player";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

type Client = SupabaseClient<Database>;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return undefined;
}

const groupId = arg("group") ?? process.env.GROUP_ID;
const file = arg("file") ?? "data/futevolei-legacy-seed.json";
const dryRun = process.argv.includes("--dry-run");

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

if (!groupId) {
  fail(
    "Informe o grupo de destino:\n" +
      "    npm run import:legacy -- --group <GROUP_ID>\n" +
      "  ou defina GROUP_ID no .env.local",
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  fail("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias para importar.");
}

const supabase: Client = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const dataset = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")) as LegacyDataset;

  console.log(`Arquivo: ${file}`);
  console.log(`Partidas no arquivo: ${dataset.matches.length}`);
  if (dryRun) console.log("Modo simulação: nada será gravado.\n");

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name, created_by, timezone")
    .eq("id", groupId!)
    .maybeSingle();

  if (groupError) fail(`Falha ao carregar o grupo: ${groupError.message}`);
  if (!group) fail(`Grupo ${groupId} não encontrado.`);

  console.log(`Grupo de destino: ${group.name} (${group.id})\n`);

  // O script roda com service_role, sem auth.uid(). O autor dos registros é o
  // dono do grupo — created_by é NOT NULL e referencia auth.users.
  const authorId = group.created_by;

  // ------------------------------------------------------------- jogadores
  const names = legacyPlayerNames(dataset);
  const { data: existingPlayers, error: playersError } = await supabase
    .from("players")
    .select("id, display_name, normalized_name")
    .eq("group_id", group.id);
  if (playersError) fail(`Falha ao listar jogadores: ${playersError.message}`);

  const playerIdByNormalized = new Map(
    (existingPlayers ?? []).map((p) => [p.normalized_name, p.id]),
  );

  const missing = names.filter((name) => !playerIdByNormalized.has(normalizePlayerName(name)));

  if (missing.length > 0 && !dryRun) {
    const { data: inserted, error } = await supabase
      .from("players")
      .insert(
        missing.map((name, index) => ({
          group_id: group.id,
          display_name: name,
          // sort_order preserva a ordem de aparição na planilha.
          sort_order: (existingPlayers?.length ?? 0) + index,
          created_by: authorId,
        })),
      )
      .select("id, normalized_name");

    if (error) fail(`Falha ao criar jogadores: ${error.message}`);
    for (const player of inserted ?? []) {
      playerIdByNormalized.set(player.normalized_name, player.id);
    }
  }

  console.log(
    `Jogadores: ${names.length} no arquivo · ${missing.length} criados · ${names.length - missing.length} reaproveitados`,
  );

  if (dryRun && missing.length > 0) {
    console.log("  (simulação) seriam criados:", missing.join(", "));
    console.log("\nSimulação encerrada — jogadores precisam existir para simular as partidas.");
    return;
  }

  const playerId = (name: string): string => {
    const id = playerIdByNormalized.get(normalizePlayerName(name));
    if (!id) fail(`Jogador não resolvido: ${name}`);
    return id;
  };

  // --------------------------------------------------------------- rodadas
  const dates = legacyDates(dataset);
  const { data: existingSessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("id, played_on")
    .eq("group_id", group.id)
    .in("played_on", dates);
  if (sessionsError) fail(`Falha ao listar rodadas: ${sessionsError.message}`);

  const sessionIdByDate = new Map((existingSessions ?? []).map((s) => [s.played_on, s.id]));
  const missingDates = dates.filter((date) => !sessionIdByDate.has(date));

  if (missingDates.length > 0 && !dryRun) {
    const { data: inserted, error } = await supabase
      .from("sessions")
      .insert(
        missingDates.map((date) => ({
          group_id: group.id,
          played_on: date,
          title: "Importado da planilha",
          created_by: authorId,
        })),
      )
      .select("id, played_on");
    if (error) fail(`Falha ao criar rodadas: ${error.message}`);
    for (const session of inserted ?? []) sessionIdByDate.set(session.played_on, session.id);
  }

  console.log(`Rodadas: ${dates.length} datas · ${missingDates.length} criadas`);

  // -------------------------------------------------------------- partidas
  const { data: existingMatches, error: matchesError } = await supabase
    .from("matches")
    .select("external_key")
    .eq("group_id", group.id)
    .not("external_key", "is", null);
  if (matchesError) fail(`Falha ao listar partidas: ${matchesError.message}`);

  const importedKeys = new Set((existingMatches ?? []).map((m) => m.external_key));

  const planned = withOccurrences(dataset.matches).map(({ match, occurrence }) => ({
    match,
    externalKey: legacyExternalKey(match, occurrence),
  }));

  const pending = planned.filter((item) => !importedKeys.has(item.externalKey));

  console.log(
    `Partidas: ${planned.length} no arquivo · ${planned.length - pending.length} já importadas · ${pending.length} a importar`,
  );

  if (dryRun) {
    console.log("\nSimulação encerrada — nada foi gravado.");
    return;
  }

  let imported = 0;
  for (const item of pending) {
    const playedAtIso = `${item.match.played_at}T15:00:00.000Z`; // 12h em America/Sao_Paulo

    const { data: inserted, error } = await supabase
      .from("matches")
      .insert({
        group_id: group.id,
        session_id: sessionIdByDate.get(item.match.played_at) ?? null,
        played_at: playedAtIso,
        // A planilha não guardava pontos: entra sem placar, só com o vencedor.
        winning_side: "A",
        team_a_score: null,
        team_b_score: null,
        external_key: item.externalKey,
        created_by: authorId,
      })
      .select("id")
      .single();

    if (error) fail(`Falha ao inserir partida (${item.externalKey}): ${error.message}`);

    const { error: lineupError } = await supabase.from("match_players").insert([
      { match_id: inserted.id, player_id: playerId(item.match.winner[0]), side: "A", slot: 1 },
      { match_id: inserted.id, player_id: playerId(item.match.winner[1]), side: "A", slot: 2 },
      { match_id: inserted.id, player_id: playerId(item.match.loser[0]), side: "B", slot: 1 },
      { match_id: inserted.id, player_id: playerId(item.match.loser[1]), side: "B", slot: 2 },
    ]);

    if (lineupError) {
      // A partida ficaria sem escalação e quebraria a validação 2x2 no COMMIT.
      await supabase.from("matches").delete().eq("id", inserted.id);
      fail(`Falha ao escalar a partida (${item.externalKey}): ${lineupError.message}`);
    }

    imported += 1;
  }

  console.log(`\n${imported} partida(s) importada(s).`);

  await verify(group.id);
}

/** Confere o que ficou no banco contra os números da planilha. */
async function verify(targetGroupId: string) {
  console.log("\n──────── Verificação pós-importação ────────");

  const [{ data: overview }, { data: playerStats }, { data: pairStats }] = await Promise.all([
    supabase.rpc("group_overview", { p_group_id: targetGroupId }),
    supabase.rpc("stats_players", { p_group_id: targetGroupId, p_min_games: 1 }),
    supabase.rpc("stats_pairs", { p_group_id: targetGroupId, p_min_games: 1 }),
  ]);

  const problems: string[] = [];

  const totalMatches = overview?.[0]?.total_matches ?? 0;
  console.log(`Partidas válidas no banco: ${totalMatches} (esperado ${EXPECTED_TOTAL_MATCHES})`);
  if (totalMatches !== EXPECTED_TOTAL_MATCHES) {
    problems.push(`total de partidas ${totalMatches} ≠ ${EXPECTED_TOTAL_MATCHES}`);
  }

  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id, played_on")
    .eq("group_id", targetGroupId);

  for (const [date, expected] of Object.entries(EXPECTED_SESSIONS)) {
    const session = (sessionRows ?? []).find((s) => s.played_on === date);
    const { count } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("group_id", targetGroupId)
      .eq("session_id", session?.id ?? "00000000-0000-0000-0000-000000000000")
      .eq("status", "confirmed")
      .is("deleted_at", null);

    if ((count ?? 0) !== expected) {
      problems.push(`${date}: ${count ?? 0} partidas ≠ ${expected}`);
    }
  }

  console.log("\nRanking individual");
  console.log("  #  Jogador    J   V   D   Aproveitamento");
  (playerStats ?? []).forEach((row, index) => {
    console.log(
      `  ${String(index + 1).padStart(2)} ${row.display_name.padEnd(9)} ${String(row.games).padStart(3)} ${String(row.wins).padStart(3)} ${String(row.losses).padStart(3)}   ${formatPercentPrecise(Number(row.win_rate))}`,
    );

    const expected = EXPECTED_PLAYER_RANKING[index];
    if (!expected) {
      problems.push(`jogador extra no ranking: ${row.display_name}`);
      return;
    }
    if (
      row.display_name !== expected.name ||
      row.games !== expected.games ||
      row.wins !== expected.wins ||
      row.losses !== expected.losses
    ) {
      problems.push(
        `posição ${index + 1}: ${row.display_name} ${row.games}/${row.wins}/${row.losses} ≠ ${expected.name} ${expected.games}/${expected.wins}/${expected.losses}`,
      );
    }
  });

  console.log(`\nDuplas: ${(pairStats ?? []).length} (esperado ${EXPECTED_PAIR_RANKING.length})`);
  if ((pairStats ?? []).length !== EXPECTED_PAIR_RANKING.length) {
    problems.push(
      `quantidade de duplas ${(pairStats ?? []).length} ≠ ${EXPECTED_PAIR_RANKING.length}`,
    );
  }

  for (const expected of EXPECTED_PAIR_RANKING) {
    const normalized = expected.players.map(normalizePlayerName).sort().join("|");
    const actual = (pairStats ?? []).find(
      (row) => row.player_names.map(normalizePlayerName).sort().join("|") === normalized,
    );
    if (!actual) {
      problems.push(`dupla ausente: ${expected.players.join(" - ")}`);
      continue;
    }
    if (
      actual.games !== expected.games ||
      actual.wins !== expected.wins ||
      actual.losses !== expected.losses
    ) {
      problems.push(
        `dupla ${expected.players.join(" - ")}: ${actual.games}/${actual.wins}/${actual.losses} ≠ ${expected.games}/${expected.wins}/${expected.losses}`,
      );
    }
  }

  if (problems.length > 0) {
    console.error(`\n✗ ${problems.length} divergência(s) em relação à planilha:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log("\n✓ Os dados no banco batem exatamente com a planilha legada.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
