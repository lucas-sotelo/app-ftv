import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Traduz erros do Postgres/PostgREST para mensagens que fazem sentido para
 * quem está com o celular na mão, na beira da quadra.
 *
 * As funções RPC devolvem um código estável em `hint` (FTV_*). Quando ele
 * existe, mandamos nele; senão caímos em heurísticas por código SQLSTATE.
 */
const BY_HINT: Record<string, string> = {
  FTV_UNAUTHENTICATED: "Sua sessão expirou. Entre novamente.",
  FTV_FORBIDDEN: "Você não tem permissão para fazer isso neste grupo.",
  FTV_OWNER_ONLY: "Apenas o proprietário do grupo pode fazer isso.",
  FTV_NOT_MEMBER: "Este usuário não é membro do grupo.",
  FTV_NOT_FOUND: "Registro não encontrado.",
  FTV_TEAM_SIZE: "Cada time precisa de exatamente 2 jogadores.",
  FTV_DUPLICATE_PLAYER: "Um jogador não pode aparecer duas vezes na mesma partida.",
  FTV_PLAYER_OTHER_GROUP: "Há um jogador que não pertence a este grupo.",
  FTV_INACTIVE_PLAYER: "Há um jogador inativo escalado. Reative-o ou escolha outro.",
  FTV_SCORE_PARTIAL: "Informe os dois placares ou deixe os dois em branco.",
  FTV_SCORE_TIE: "A partida não pode terminar empatada.",
  FTV_WINNER_REQUIRED: "Sem placar, escolha qual time venceu.",
  FTV_SCORE_WINNER_MISMATCH: "O time vencedor não confere com o placar informado.",
  FTV_SESSION_OTHER_GROUP: "A rodada selecionada não pertence a este grupo.",
  FTV_INVITE_INVALID: "Convite inválido. Confira o código.",
  FTV_INVITE_REVOKED: "Este convite foi revogado.",
  FTV_INVITE_EXPIRED: "Este convite expirou.",
  FTV_INVITE_EXHAUSTED: "Este convite atingiu o limite de usos.",
  FTV_INVITE_OWNER: "Um convite não pode conceder propriedade do grupo.",
  FTV_INVALID_NAME: "Informe um nome válido.",
  FTV_SLUG_EXHAUSTED: "Não foi possível gerar um endereço para o grupo. Tente outro nome.",
};

const BY_CONSTRAINT: Record<string, string> = {
  players_group_normalized_name_key: "Já existe um jogador com esse nome neste grupo.",
  players_group_linked_user_key: "Este usuário já está vinculado a outro jogador do grupo.",
  sessions_group_played_on_key: "Já existe uma rodada nessa data.",
  matches_scores_both_or_none: "Informe os dois placares ou deixe os dois em branco.",
  matches_scores_distinct: "A partida não pode terminar empatada.",
  matches_winner_matches_score: "O time vencedor não confere com o placar informado.",
  group_invitations_role_not_owner: "Um convite não pode conceder propriedade do grupo.",
  groups_slug_key: "Já existe um grupo com esse endereço.",
};

export function translateSupabaseError(error: unknown): string {
  if (!error) return "Algo deu errado. Tente novamente.";

  const pgError = error as Partial<PostgrestError> & { message?: string; status?: number };

  if (pgError.hint && BY_HINT[pgError.hint]) return BY_HINT[pgError.hint];

  const details = `${pgError.message ?? ""} ${pgError.details ?? ""}`;
  for (const [constraint, message] of Object.entries(BY_CONSTRAINT)) {
    if (details.includes(constraint)) return message;
  }

  switch (pgError.code) {
    case "23505":
      return "Este registro já existe.";
    case "23503":
      return "Não é possível remover: existem partidas ligadas a este registro.";
    case "23514":
      return pgError.message ?? "Dados inválidos.";
    case "42501":
      return "Você não tem permissão para fazer isso.";
    case "PGRST301":
    case "401":
      return "Sua sessão expirou. Entre novamente.";
    default:
      break;
  }

  if (pgError.message) return pgError.message;
  return "Algo deu errado. Tente novamente.";
}

/** Erros de rede não devem virar "algo deu errado" genérico. */
export function isOfflineError(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? "";
  return /failed to fetch|network|offline|load failed/i.test(message);
}

export function describeActionError(error: unknown): string {
  if (isOfflineError(error)) {
    return "Sem conexão. A partida não foi salva — tente de novo quando a internet voltar.";
  }
  return translateSupabaseError(error);
}
