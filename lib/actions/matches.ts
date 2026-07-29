"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { composePlayedAt } from "@/lib/utils/played-at";
import { matchFormSchema, sessionSchema, type MatchFormInput } from "@/lib/validations/match";
import { failure, success, type ActionResult } from "./result";

interface MatchActionContext {
  groupId: string;
  slug: string;
  timeZone: string;
}

function revalidateGroup(slug: string) {
  revalidatePath(`/${slug}`, "layout");
}

export async function ensureSessionAction(
  ctx: MatchActionContext,
  input: {
    playedOn: string;
    title?: string | null;
    location?: string | null;
    notes?: string | null;
  },
): Promise<ActionResult<{ id: string; playedOn: string }>> {
  const parsed = sessionSchema.safeParse({
    playedOn: input.playedOn,
    title: input.title ?? null,
    location: input.location ?? null,
    notes: input.notes ?? null,
  });
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_or_create_session", {
      p_group_id: ctx.groupId,
      p_played_on: parsed.data.playedOn,
      p_title: parsed.data.title,
      p_location: parsed.data.location,
      p_notes: parsed.data.notes,
    });
    if (error) return failure(error);

    revalidateGroup(ctx.slug);
    return success({ id: data.id, playedOn: data.played_on });
  } catch (error) {
    return failure(error);
  }
}

export async function createMatchAction(
  ctx: MatchActionContext,
  input: MatchFormInput,
): Promise<ActionResult<{ matchId: string; sessionId: string }>> {
  const parsed = matchFormSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));
  const values = parsed.data;

  try {
    const supabase = await createClient();

    // Uma rodada por data: garante que várias partidas do mesmo dia caiam
    // na mesma sessão mesmo com dois admins lançando ao mesmo tempo.
    const session = await ensureSessionAction(ctx, { playedOn: values.sessionDate });
    if (!session.ok) return session;

    const { data, error } = await supabase.rpc("create_match", {
      p_group_id: ctx.groupId,
      p_played_at: composePlayedAt(values.sessionDate, ctx.timeZone),
      p_team_a: [...values.teamA],
      p_team_b: [...values.teamB],
      p_winning_side: values.winningSide,
      p_team_a_score: values.teamAScore,
      p_team_b_score: values.teamBScore,
      p_session_id: session.data.id,
      p_notes: values.notes,
    });

    if (error) return failure(error);

    revalidateGroup(ctx.slug);
    return success({ matchId: data, sessionId: session.data.id });
  } catch (error) {
    return failure(error);
  }
}

export async function updateMatchAction(
  ctx: MatchActionContext,
  matchId: string,
  input: MatchFormInput,
): Promise<ActionResult> {
  const parsed = matchFormSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));
  const values = parsed.data;

  try {
    const supabase = await createClient();

    const session = await ensureSessionAction(ctx, { playedOn: values.sessionDate });
    if (!session.ok) return session;

    const { error } = await supabase.rpc("update_match", {
      p_match_id: matchId,
      p_played_at: composePlayedAt(values.sessionDate, ctx.timeZone),
      p_team_a: [...values.teamA],
      p_team_b: [...values.teamB],
      p_winning_side: values.winningSide,
      p_team_a_score: values.teamAScore,
      p_team_b_score: values.teamBScore,
      p_session_id: session.data.id,
      p_notes: values.notes,
    });

    if (error) return failure(error);
    revalidateGroup(ctx.slug);
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function voidMatchAction(
  slug: string,
  matchId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("void_match", {
      p_match_id: matchId,
      p_reason: reason ?? null,
    });
    if (error) return failure(error);
    revalidateGroup(slug);
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function deleteMatchAction(
  slug: string,
  matchId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_match", {
      p_match_id: matchId,
      p_reason: reason ?? null,
    });
    if (error) return failure(error);
    revalidateGroup(slug);
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function restoreMatchAction(slug: string, matchId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("restore_match", { p_match_id: matchId });
    if (error) return failure(error);
    revalidateGroup(slug);
    return success();
  } catch (error) {
    return failure(error);
  }
}
