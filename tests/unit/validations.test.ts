import { describe, expect, it } from "vitest";
import { assignableRoles, can, isAdmin, isOwner } from "@/lib/permissions";
import { translateSupabaseError } from "@/lib/supabase/errors";
import { matchFormSchema } from "@/lib/validations/match";
import { normalizePlayerName, playerSchema } from "@/lib/validations/player";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";

const base = {
  sessionDate: "2026-07-05",
  sessionId: null,
  teamA: [A, B] as [string, string],
  teamB: [C, D] as [string, string],
  teamAScore: null,
  teamBScore: null,
  winningSide: "A" as const,
  notes: null,
};

describe("normalização de nome de jogador", () => {
  it("faz trim e colapsa espaços internos", () => {
    expect(normalizePlayerName("  Luis   Aguiar ")).toBe("luis aguiar");
  });

  it("ignora diferença de caixa", () => {
    expect(normalizePlayerName("ALEX")).toBe(normalizePlayerName("alex"));
  });

  it("preserva acentos — só a comparação é insensível a caixa", () => {
    expect(normalizePlayerName("Léo")).toBe("léo");
    expect(normalizePlayerName("Léo")).not.toBe(normalizePlayerName("Leo"));
  });

  it("limpa o nome exibido sem tirar acento", () => {
    const parsed = playerSchema.parse({
      displayName: "  Léo   Silva ",
      isGuest: false,
      active: true,
      sortOrder: 0,
      linkedUserId: null,
    });
    expect(parsed.displayName).toBe("Léo Silva");
  });
});

describe("schema do formulário de partida", () => {
  it("aceita partida sem placar com vencedor escolhido", () => {
    expect(matchFormSchema.safeParse(base).success).toBe(true);
  });

  it("aceita partida com placar e deriva o vencedor depois", () => {
    const result = matchFormSchema.safeParse({
      ...base,
      teamAScore: 15,
      teamBScore: 12,
      winningSide: null,
    });
    expect(result.success).toBe(true);
  });

  it("recusa jogador repetido entre os times", () => {
    const result = matchFormSchema.safeParse({ ...base, teamB: [A, D] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/duas vezes/i);
  });

  it("recusa apenas um placar preenchido", () => {
    const result = matchFormSchema.safeParse({ ...base, teamAScore: 15, winningSide: null });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/dois placares/i);
  });

  it("recusa empate", () => {
    const result = matchFormSchema.safeParse({ ...base, teamAScore: 12, teamBScore: 12 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/empatada/i);
  });

  it("exige vencedor quando não há placar", () => {
    const result = matchFormSchema.safeParse({ ...base, winningSide: null });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/qual time venceu/i);
  });

  it("recusa data inválida", () => {
    expect(matchFormSchema.safeParse({ ...base, sessionDate: "05/07/2026" }).success).toBe(false);
  });
});

describe("modelo de permissões", () => {
  it("owner e admin administram; member não", () => {
    expect(isAdmin("owner")).toBe(true);
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("member")).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("apenas owner mexe em propriedade", () => {
    expect(isOwner("owner")).toBe(true);
    expect(can.manageOwners("admin")).toBe(false);
    expect(can.deleteGroup("admin")).toBe(false);
  });

  it("admin não consegue atribuir o papel de owner", () => {
    expect(assignableRoles("admin")).not.toContain("owner");
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("member")).toEqual([]);
  });

  it("member não vê ações administrativas", () => {
    expect(can.manageMatches("member")).toBe(false);
    expect(can.managePlayers("member")).toBe(false);
    expect(can.manageInvitations("member")).toBe(false);
  });
});

describe("tradução de erros do banco", () => {
  it("usa o código estável devolvido pelas RPCs", () => {
    expect(translateSupabaseError({ hint: "FTV_INACTIVE_PLAYER", message: "x" })).toMatch(
      /inativo/i,
    );
    expect(translateSupabaseError({ hint: "FTV_INVITE_EXPIRED", message: "x" })).toMatch(
      /expirou/i,
    );
  });

  it("reconhece violação de unicidade de jogador", () => {
    expect(
      translateSupabaseError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "players_group_normalized_name_key"',
      }),
    ).toMatch(/já existe um jogador/i);
  });

  it("tem mensagem para falta de permissão", () => {
    expect(translateSupabaseError({ code: "42501", message: "denied" })).toMatch(/permissão/i);
  });
});
