import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  legacyDates,
  legacyExternalKey,
  legacyPlayerNames,
  withOccurrences,
  type LegacyDataset,
} from "@/lib/legacy/dataset";
import {
  EXPECTED_PAIR_DUELS,
  EXPECTED_PAIR_RANKING,
  EXPECTED_PLAYER_DUELS,
  EXPECTED_PLAYER_RANKING,
  EXPECTED_SESSIONS,
  EXPECTED_TOTAL_MATCHES,
} from "@/lib/legacy/expected";
import { normalizePlayerName } from "@/lib/validations/player";
import {
  cleanupTestUsers,
  createGroup,
  createTestUser,
  deleteGroup,
  type TestUser,
} from "./helpers";

/**
 * Prova que as FUNÇÕES SQL de estatística produzem os mesmos números da
 * planilha. Os testes unitários checam o oráculo em TypeScript; aqui o
 * Postgres precisa concordar com ele.
 */
describe("paridade da camada SQL com a planilha legada", () => {
  const dataset = JSON.parse(
    readFileSync(resolve(process.cwd(), "data/futevolei-legacy-seed.json"), "utf8"),
  ) as LegacyDataset;

  let owner: TestUser;
  let group: { id: string; slug: string };
  const playerIdByNormalized = new Map<string, string>();
  const idByName = new Map<string, string>();

  beforeAll(async () => {
    owner = await createTestUser("legacy");
    group = await createGroup(owner, "Futevôlei legado (teste)");

    // Jogadores
    const names = legacyPlayerNames(dataset);
    const { data: players, error } = await owner.client
      .from("players")
      .insert(
        names.map((name, index) => ({
          group_id: group.id,
          display_name: name,
          sort_order: index,
          created_by: owner.user.id,
        })),
      )
      .select("id, display_name, normalized_name");
    if (error) throw new Error(error.message);

    for (const player of players!) {
      playerIdByNormalized.set(player.normalized_name, player.id);
      idByName.set(player.display_name, player.id);
    }

    // Rodadas
    const dates = legacyDates(dataset);
    const { data: sessions, error: sessionError } = await owner.client
      .from("sessions")
      .insert(
        dates.map((date) => ({
          group_id: group.id,
          played_on: date,
          created_by: owner.user.id,
        })),
      )
      .select("id, played_on");
    if (sessionError) throw new Error(sessionError.message);
    const sessionByDate = new Map(sessions!.map((s) => [s.played_on, s.id]));

    // Partidas, pela mesma RPC que o app usa.
    const idOf = (name: string) => {
      const id = playerIdByNormalized.get(normalizePlayerName(name));
      if (!id) throw new Error(`Jogador não resolvido: ${name}`);
      return id;
    };

    for (const { match, occurrence } of withOccurrences(dataset.matches)) {
      const { error: matchError } = await owner.client.rpc("create_match", {
        p_group_id: group.id,
        p_played_at: `${match.played_at}T15:00:00.000Z`,
        p_team_a: [idOf(match.winner[0]), idOf(match.winner[1])],
        p_team_b: [idOf(match.loser[0]), idOf(match.loser[1])],
        p_winning_side: "A",
        p_team_a_score: null,
        p_team_b_score: null,
        p_session_id: sessionByDate.get(match.played_at) ?? null,
        p_notes: null,
        p_external_key: legacyExternalKey(match, occurrence),
      });
      if (matchError) throw new Error(`Falha ao importar partida: ${matchError.message}`);
    }
  }, 180_000);

  afterAll(async () => {
    await deleteGroup(group.id);
    await cleanupTestUsers();
  });

  it("importa exatamente 39 partidas", async () => {
    const { data } = await owner.client.rpc("group_overview", { p_group_id: group.id });
    expect(data![0].total_matches).toBe(EXPECTED_TOTAL_MATCHES);
  });

  it("é idempotente: reimportar não duplica nada", async () => {
    const first = withOccurrences(dataset.matches)[0];
    const idOf = (name: string) => playerIdByNormalized.get(normalizePlayerName(name))!;

    const { data: matchId, error } = await owner.client.rpc("create_match", {
      p_group_id: group.id,
      p_played_at: `${first.match.played_at}T15:00:00.000Z`,
      p_team_a: [idOf(first.match.winner[0]), idOf(first.match.winner[1])],
      p_team_b: [idOf(first.match.loser[0]), idOf(first.match.loser[1])],
      p_winning_side: "A",
      p_team_a_score: null,
      p_team_b_score: null,
      p_session_id: null,
      p_notes: null,
      p_external_key: legacyExternalKey(first.match, first.occurrence),
    });

    expect(error).toBeNull();
    expect(matchId).toBeTruthy();

    const { data } = await owner.client.rpc("group_overview", { p_group_id: group.id });
    expect(data![0].total_matches).toBe(EXPECTED_TOTAL_MATCHES);
  });

  it("distribui as partidas nas seis datas corretas", async () => {
    const { data: sessions } = await owner.client
      .from("sessions")
      .select("id, played_on")
      .eq("group_id", group.id);

    for (const [date, expected] of Object.entries(EXPECTED_SESSIONS)) {
      const session = sessions!.find((s) => s.played_on === date);
      const { count } = await owner.client
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session!.id)
        .eq("status", "confirmed")
        .is("deleted_at", null);
      expect(count, `partidas em ${date}`).toBe(expected);
    }
  });

  it("reproduz o ranking individual da planilha", async () => {
    const { data } = await owner.client.rpc("stats_players", {
      p_group_id: group.id,
      p_min_attendance_percent: 0,
    });

    expect(
      data!.map((row, index) => ({
        position: index + 1,
        name: row.display_name,
        games: row.games,
        wins: row.wins,
        losses: row.losses,
      })),
    ).toEqual(EXPECTED_PLAYER_RANKING);
  });

  it("reproduz o ranking de duplas da planilha", async () => {
    const { data } = await owner.client.rpc("stats_pairs", {
      p_group_id: group.id,
      p_min_games: 1,
    });

    expect(data).toHaveLength(EXPECTED_PAIR_RANKING.length);

    for (const expected of EXPECTED_PAIR_RANKING) {
      const key = expected.players.map(normalizePlayerName).sort().join("|");
      const row = data!.find(
        (entry) => entry.player_names.map(normalizePlayerName).sort().join("|") === key,
      );
      expect(row, `dupla ${expected.players.join(" - ")}`).toBeDefined();
      expect({ games: row!.games, wins: row!.wins, losses: row!.losses }).toEqual({
        games: expected.games,
        wins: expected.wins,
        losses: expected.losses,
      });
    }
  });

  it("reproduz os confrontos individuais de referência", async () => {
    const { data } = await owner.client.rpc("stats_player_head_to_head", {
      p_group_id: group.id,
      p_min_games: 1,
    });

    for (const expected of EXPECTED_PLAYER_DUELS) {
      const [a, b] = expected.players.map((name) => idByName.get(name)!);
      const row = data!.find(
        (entry) =>
          (entry.player_1_id === a && entry.player_2_id === b) ||
          (entry.player_1_id === b && entry.player_2_id === a),
      );

      expect(row, `confronto ${expected.players.join(" x ")}`).toBeDefined();
      expect(row!.games).toBe(expected.games);

      const oriented =
        row!.player_1_id === a
          ? [row!.player_1_wins, row!.player_2_wins]
          : [row!.player_2_wins, row!.player_1_wins];
      expect(oriented).toEqual(expected.wins);
    }
  });

  it("reproduz os confrontos entre duplas de referência", async () => {
    const { data } = await owner.client.rpc("stats_pair_head_to_head", {
      p_group_id: group.id,
      p_min_games: 1,
    });

    const keyOf = (names: [string, string]) =>
      names
        .map((name) => idByName.get(name)!)
        .sort()
        .join(":");

    for (const expected of EXPECTED_PAIR_DUELS) {
      const k1 = keyOf(expected.pair1);
      const k2 = keyOf(expected.pair2);
      const row = data!.find(
        (entry) =>
          (entry.pair_1_key === k1 && entry.pair_2_key === k2) ||
          (entry.pair_1_key === k2 && entry.pair_2_key === k1),
      );

      const label = `${expected.pair1.join("-")} x ${expected.pair2.join("-")}`;
      expect(row, `confronto ${label}`).toBeDefined();
      expect(row!.games).toBe(expected.games);

      const oriented =
        row!.pair_1_key === k1
          ? [row!.pair_1_wins, row!.pair_2_wins]
          : [row!.pair_2_wins, row!.pair_1_wins];
      expect(oriented).toEqual(expected.wins);
    }
  });

  it("a identidade da dupla não depende da ordem digitada", async () => {
    const { data } = await owner.client.rpc("stats_pairs", {
      p_group_id: group.id,
      p_min_games: 1,
    });

    // "Luis + Alex" e "Alex + Luis" precisam ser a MESMA linha.
    const keys = data!.map((row) => row.pair_key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("respeita o percentual mínimo de presença do ranking oficial", async () => {
    const { data } = await owner.client.rpc("stats_players", {
      p_group_id: group.id,
      p_min_attendance_percent: 20,
    });
    // Sotelo (4/39 ≈ 10%) e Arthur (5/39 ≈ 13%) ficam de fora do ranking
    // oficial, mas continuam aparecendo na resposta como aspirantes.
    expect(
      data!
        .filter((row) => row.meets_min_attendance)
        .map((row) => row.display_name)
        .sort(),
    ).toEqual(["Alex", "Daniel", "Luis", "Léo", "Ronaldo"].sort());
    expect(
      data!
        .filter((row) => !row.meets_min_attendance)
        .map((row) => row.display_name)
        .sort(),
    ).toEqual(["Arthur", "Sotelo"].sort());
  });

  it("uma partida anulada some das estatísticas", async () => {
    const { data: match } = await owner.client
      .from("matches")
      .select("id")
      .eq("group_id", group.id)
      .limit(1)
      .single();

    await owner.client.rpc("void_match", { p_match_id: match!.id, p_reason: "teste" });

    const { data } = await owner.client.rpc("group_overview", { p_group_id: group.id });
    expect(data![0].total_matches).toBe(EXPECTED_TOTAL_MATCHES - 1);

    await owner.client.rpc("restore_match", { p_match_id: match!.id });
    const { data: restored } = await owner.client.rpc("group_overview", { p_group_id: group.id });
    expect(restored![0].total_matches).toBe(EXPECTED_TOTAL_MATCHES);
  });

  it("filtro de período recorta corretamente", async () => {
    const { data } = await owner.client.rpc("stats_players", {
      p_group_id: group.id,
      // 05/07/2026 apenas (fuso America/Sao_Paulo).
      p_from: "2026-07-05T03:00:00.000Z",
      p_to: "2026-07-06T03:00:00.000Z",
      p_min_attendance_percent: 0,
    });

    const totalGames = data!.reduce((sum, row) => sum + row.games, 0);
    expect(totalGames).toBe(EXPECTED_SESSIONS["2026-07-05"] * 4);
  });

  it("mantém a auditoria de tudo que foi criado", async () => {
    const { count } = await owner.client
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id)
      .eq("entity_type", "match")
      .eq("action", "create");

    expect(count).toBe(EXPECTED_TOTAL_MATCHES);
  });
});
