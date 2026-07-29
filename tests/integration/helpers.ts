import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type Client = SupabaseClient<Database>;

export const admin: Client = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface TestUser {
  user: User;
  client: Client;
  email: string;
}

const createdUserIds: string[] = [];

/** Cria um usuário confirmado e devolve um cliente já autenticado como ele. */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `ftv-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = "senha-de-teste-123";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Teste ${label}` },
  });
  if (error || !data.user) throw new Error(`Falha ao criar usuário de teste: ${error?.message}`);
  createdUserIds.push(data.user.id);

  const client = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Falha ao autenticar usuário de teste: ${signInError.message}`);

  return { user: data.user, client, email };
}

export async function cleanupTestUsers() {
  for (const id of createdUserIds.splice(0)) {
    // Cascade em group_members/profiles; grupos criados são apagados junto
    // pelos testes que os criaram.
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
}

export async function createGroup(user: TestUser, name: string) {
  const { data, error } = await user.client.rpc("create_group_with_owner", { p_name: name });
  if (error) throw new Error(`Falha ao criar grupo: ${error.message}`);
  return data;
}

export async function deleteGroup(groupId: string) {
  await admin.from("groups").delete().eq("id", groupId);
}

export async function createPlayer(user: TestUser, groupId: string, displayName: string) {
  const { data, error } = await user.client
    .from("players")
    .insert({ group_id: groupId, display_name: displayName, created_by: user.user.id })
    .select("*")
    .single();
  if (error) throw new Error(`Falha ao criar jogador ${displayName}: ${error.message}`);
  return data;
}

export async function createFourPlayers(user: TestUser, groupId: string) {
  const names = ["Luis", "Alex", "Daniel", "Ronaldo"];
  const players = [];
  for (const name of names) players.push(await createPlayer(user, groupId, name));
  return players;
}

export async function createMatch(
  client: Client,
  args: {
    groupId: string;
    teamA: [string, string];
    teamB: [string, string];
    winningSide?: "A" | "B";
    teamAScore?: number | null;
    teamBScore?: number | null;
    playedAt?: string;
  },
) {
  return client.rpc("create_match", {
    p_group_id: args.groupId,
    p_played_at: args.playedAt ?? new Date().toISOString(),
    p_team_a: args.teamA,
    p_team_b: args.teamB,
    p_winning_side: args.winningSide ?? "A",
    p_team_a_score: args.teamAScore ?? null,
    p_team_b_score: args.teamBScore ?? null,
    p_session_id: null,
    p_notes: null,
    p_external_key: null,
  });
}
