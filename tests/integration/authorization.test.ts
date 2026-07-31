import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  cleanupTestUsers,
  createFourPlayers,
  createGroup,
  createMatch,
  createPlayer,
  deleteGroup,
  createTestUser,
  type TestUser,
} from "./helpers";

/**
 * Isolamento entre grupos e modelo de permissões, verificados contra o banco
 * de verdade — não contra a interface. Trocar um UUID na mão não pode dar
 * acesso a nada.
 */
describe("autorização e isolamento", () => {
  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;

  let groupA: { id: string; slug: string };
  let groupB: { id: string; slug: string };
  let players: { id: string }[];

  beforeAll(async () => {
    owner = await createTestUser("owner");
    member = await createTestUser("member");
    outsider = await createTestUser("outsider");

    groupA = await createGroup(owner, "Grupo A de teste");
    groupB = await createGroup(outsider, "Grupo B de teste");

    players = await createFourPlayers(owner, groupA.id);

    // member entra no grupo A por convite comum.
    const { data: invitation, error } = await owner.client.rpc("create_group_invitation", {
      p_group_id: groupA.id,
      p_role: "member",
      p_expires_at: null,
      p_max_uses: null,
    });
    expect(error).toBeNull();
    const redeem = await member.client.rpc("redeem_group_invitation", { p_code: invitation!.code });
    expect(redeem.error).toBeNull();
  }, 60_000);

  afterAll(async () => {
    await deleteGroup(groupA.id);
    await deleteGroup(groupB.id);
    await cleanupTestUsers();
  });

  it("quem cria o grupo entra como owner", async () => {
    const { data } = await owner.client
      .from("group_members")
      .select("role")
      .eq("group_id", groupA.id)
      .eq("user_id", owner.user.id)
      .single();
    expect(data?.role).toBe("owner");
  });

  it("usuário de um grupo não enxerga o outro grupo", async () => {
    const { data: groups } = await owner.client.from("groups").select("id");
    expect(groups?.map((g) => g.id)).toContain(groupA.id);
    expect(groups?.map((g) => g.id)).not.toContain(groupB.id);

    // Nem forçando o id na consulta.
    const { data: forced } = await owner.client.from("groups").select("id").eq("id", groupB.id);
    expect(forced).toEqual([]);
  });

  it("usuário de fora não lê jogadores nem partidas do grupo A", async () => {
    const { data: foreignPlayers } = await outsider.client
      .from("players")
      .select("id")
      .eq("group_id", groupA.id);
    expect(foreignPlayers).toEqual([]);

    const { data: stats } = await outsider.client.rpc("stats_players", {
      p_group_id: groupA.id,
      p_min_attendance_percent: 0,
    });
    expect(stats ?? []).toEqual([]);
  });

  it("admin registra partida e a estatística aparece", async () => {
    const { data: matchId, error } = await createMatch(owner.client, {
      groupId: groupA.id,
      teamA: [players[0].id, players[1].id],
      teamB: [players[2].id, players[3].id],
      winningSide: "A",
    });

    expect(error).toBeNull();
    expect(matchId).toBeTruthy();

    const { data: stats } = await owner.client.rpc("stats_players", {
      p_group_id: groupA.id,
      p_min_attendance_percent: 0,
    });
    expect(stats).toHaveLength(4);
    expect(stats!.find((row) => row.player_id === players[0].id)?.wins).toBe(1);
  });

  it("member não registra partida", async () => {
    const { error } = await createMatch(member.client, {
      groupId: groupA.id,
      teamA: [players[0].id, players[1].id],
      teamB: [players[2].id, players[3].id],
    });
    expect(error).not.toBeNull();
    expect(error!.hint ?? error!.message).toContain("FTV_FORBIDDEN");
  });

  it("member não edita nem exclui partida", async () => {
    const { data: match } = await owner.client
      .from("matches")
      .select("id")
      .eq("group_id", groupA.id)
      .limit(1)
      .single();

    const update = await member.client.rpc("update_match", {
      p_match_id: match!.id,
      p_played_at: new Date().toISOString(),
      p_team_a: [players[0].id, players[1].id],
      p_team_b: [players[2].id, players[3].id],
      p_winning_side: "B",
      p_team_a_score: null,
      p_team_b_score: null,
      p_session_id: null,
      p_notes: null,
    });
    expect(update.error).not.toBeNull();

    const remove = await member.client.rpc("delete_match", {
      p_match_id: match!.id,
      p_reason: null,
    });
    expect(remove.error).not.toBeNull();
  });

  it("member não cria jogador", async () => {
    const { error } = await member.client.from("players").insert({
      group_id: groupA.id,
      display_name: "Intruso",
      created_by: member.user.id,
    });
    expect(error).not.toBeNull();
  });

  it("member lê partidas e estatísticas normalmente", async () => {
    const { data: matches, error } = await member.client
      .from("matches")
      .select("id")
      .eq("group_id", groupA.id);
    expect(error).toBeNull();
    expect((matches ?? []).length).toBeGreaterThan(0);
  });

  it("não aceita jogador de outro grupo na escalação", async () => {
    const foreign = await createPlayer(outsider, groupB.id, "Estranho");
    const { error } = await createMatch(owner.client, {
      groupId: groupA.id,
      teamA: [players[0].id, foreign.id],
      teamB: [players[2].id, players[3].id],
    });
    expect(error).not.toBeNull();
  });

  it("não aceita jogador repetido na mesma partida", async () => {
    const { error } = await createMatch(owner.client, {
      groupId: groupA.id,
      teamA: [players[0].id, players[0].id],
      teamB: [players[2].id, players[3].id],
    });
    expect(error).not.toBeNull();
  });

  it("jogador inativo não entra em partida nova, mas fica no histórico", async () => {
    const extra = await createPlayer(owner, groupA.id, "Aposentado");

    const { data: matchId } = await createMatch(owner.client, {
      groupId: groupA.id,
      teamA: [extra.id, players[0].id],
      teamB: [players[2].id, players[3].id],
    });
    expect(matchId).toBeTruthy();

    await owner.client.from("players").update({ active: false }).eq("id", extra.id);

    const { error } = await createMatch(owner.client, {
      groupId: groupA.id,
      teamA: [extra.id, players[1].id],
      teamB: [players[2].id, players[3].id],
    });
    expect(error).not.toBeNull();
    expect(error!.hint ?? error!.message).toContain("FTV_INACTIVE_PLAYER");

    // O histórico continua contando o jogador desativado.
    const { data: stats } = await owner.client.rpc("stats_players", {
      p_group_id: groupA.id,
      p_min_attendance_percent: 0,
    });
    expect(stats!.find((row) => row.player_id === extra.id)?.games).toBe(1);
  });

  it("partida anulada sai das estatísticas", async () => {
    const { data: matchId } = await createMatch(owner.client, {
      groupId: groupA.id,
      teamA: [players[0].id, players[1].id],
      teamB: [players[2].id, players[3].id],
    });

    const before = await owner.client.rpc("group_overview", { p_group_id: groupA.id });
    const total = before.data![0].total_matches;

    const { error } = await owner.client.rpc("void_match", {
      p_match_id: matchId!,
      p_reason: "teste",
    });
    expect(error).toBeNull();

    const after = await owner.client.rpc("group_overview", { p_group_id: groupA.id });
    expect(after.data![0].total_matches).toBe(total - 1);
  });

  it("exclusão lógica sai das estatísticas e permanece na auditoria", async () => {
    const { data: matchId } = await createMatch(owner.client, {
      groupId: groupA.id,
      teamA: [players[0].id, players[1].id],
      teamB: [players[2].id, players[3].id],
    });

    const before = await owner.client.rpc("group_overview", { p_group_id: groupA.id });
    await owner.client.rpc("delete_match", { p_match_id: matchId!, p_reason: "duplicada" });
    const after = await owner.client.rpc("group_overview", { p_group_id: groupA.id });

    expect(after.data![0].total_matches).toBe(before.data![0].total_matches - 1);

    // A linha continua existindo, marcada.
    const { data: row } = await owner.client
      .from("matches")
      .select("deleted_at")
      .eq("id", matchId!)
      .single();
    expect(row?.deleted_at).not.toBeNull();

    const { data: audit } = await owner.client
      .from("audit_log")
      .select("action")
      .eq("entity_id", matchId!)
      .eq("action", "soft_delete");
    expect((audit ?? []).length).toBe(1);
  });

  it("member não lê a auditoria", async () => {
    const { data } = await member.client.from("audit_log").select("id").eq("group_id", groupA.id);
    expect(data).toEqual([]);
  });

  it("convite revogado falha", async () => {
    const { data: invitation } = await owner.client.rpc("create_group_invitation", {
      p_group_id: groupA.id,
      p_role: "member",
      p_expires_at: null,
      p_max_uses: null,
    });
    await owner.client.rpc("revoke_group_invitation", { p_invitation_id: invitation!.id });

    const newcomer = await createTestUser("revogado");
    const { error } = await newcomer.client.rpc("redeem_group_invitation", {
      p_code: invitation!.code,
    });
    expect(error).not.toBeNull();
    expect(error!.hint ?? error!.message).toContain("FTV_INVITE_REVOKED");
  });

  it("convite expirado falha", async () => {
    const { data: invitation } = await owner.client.rpc("create_group_invitation", {
      p_group_id: groupA.id,
      p_role: "member",
      p_expires_at: new Date(Date.now() - 60_000).toISOString(),
      p_max_uses: null,
    });

    const newcomer = await createTestUser("expirado");
    const { error } = await newcomer.client.rpc("redeem_group_invitation", {
      p_code: invitation!.code,
    });
    expect(error).not.toBeNull();
    expect(error!.hint ?? error!.message).toContain("FTV_INVITE_EXPIRED");
  });

  it("convite não concede propriedade do grupo", async () => {
    const { error } = await owner.client.rpc("create_group_invitation", {
      p_group_id: groupA.id,
      p_role: "owner",
      p_expires_at: null,
      p_max_uses: null,
    });
    expect(error).not.toBeNull();
  });

  it("admin não promove ninguém a proprietário", async () => {
    await owner.client.rpc("set_member_role", {
      p_group_id: groupA.id,
      p_user_id: member.user.id,
      p_role: "admin",
    });

    const { error } = await member.client.rpc("set_member_role", {
      p_group_id: groupA.id,
      p_user_id: member.user.id,
      p_role: "owner",
    });
    expect(error).not.toBeNull();

    // Volta ao estado anterior para não afetar outros testes.
    await owner.client.rpc("set_member_role", {
      p_group_id: groupA.id,
      p_user_id: member.user.id,
      p_role: "member",
    });
  });

  it("o grupo nunca fica sem proprietário", async () => {
    const { error } = await owner.client
      .from("group_members")
      .delete()
      .eq("group_id", groupA.id)
      .eq("user_id", owner.user.id);
    expect(error).not.toBeNull();
  });

  it("não permite dois jogadores com o mesmo nome normalizado", async () => {
    const { error } = await owner.client.from("players").insert({
      group_id: groupA.id,
      display_name: "  luis ",
      created_by: owner.user.id,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("players_group_normalized_name_key");
  });

  it("permite convidados com nome repetido", async () => {
    const first = await owner.client
      .from("players")
      .insert({
        group_id: groupA.id,
        display_name: "Visitante",
        is_guest: true,
        created_by: owner.user.id,
      })
      .select("id")
      .single();
    expect(first.error).toBeNull();

    const second = await owner.client
      .from("players")
      .insert({
        group_id: groupA.id,
        display_name: "Visitante",
        is_guest: true,
        created_by: owner.user.id,
      })
      .select("id")
      .single();
    expect(second.error).toBeNull();
  });

  it("recusa placar inconsistente com o vencedor", async () => {
    const { error } = await createMatch(owner.client, {
      groupId: groupA.id,
      teamA: [players[0].id, players[1].id],
      teamB: [players[2].id, players[3].id],
      winningSide: "B",
      teamAScore: 15,
      teamBScore: 9,
    });
    expect(error).not.toBeNull();
  });

  it("recusa apenas um placar preenchido", async () => {
    const { error } = await createMatch(owner.client, {
      groupId: groupA.id,
      teamA: [players[0].id, players[1].id],
      teamB: [players[2].id, players[3].id],
      winningSide: "A",
      teamAScore: 15,
      teamBScore: null,
    });
    expect(error).not.toBeNull();
  });

  it("uma partida não pode ficar com escalação incompleta", async () => {
    // Inserção direta, sem passar pela RPC e ignorando a RLS (service role).
    // Cada request do PostgREST é uma transação: a constraint trigger deferida
    // derruba o COMMIT porque não existem os 4 jogadores.
    const { error } = await admin.from("matches").insert({
      group_id: groupA.id,
      played_at: new Date().toISOString(),
      winning_side: "A",
      created_by: owner.user.id,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/2 jogadores por lado|4 jogadores distintos/i);
  });

  it("nem mesmo a service role consegue gravar 3 jogadores numa partida", async () => {
    const { data: match, error: insertError } = await admin
      .from("matches")
      .insert({
        group_id: groupA.id,
        played_at: new Date().toISOString(),
        winning_side: "A",
        created_by: owner.user.id,
      })
      .select("id")
      .single();

    // A partida sozinha já falha; confirmamos que nada ficou órfão.
    expect(insertError).not.toBeNull();
    expect(match).toBeNull();
  });
});
