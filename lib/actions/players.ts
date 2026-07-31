"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  nicknameSchema,
  playerSchema,
  quickPlayerSchema,
  type PlayerInput,
} from "@/lib/validations/player";
import { failure, success, type ActionResult } from "./result";

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function createPlayerAction(
  groupId: string,
  slug: string,
  input: PlayerInput,
): Promise<ActionResult<{ id: string; displayName: string }>> {
  const parsed = playerSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

    const { data, error } = await supabase
      .from("players")
      .insert({
        group_id: groupId,
        display_name: parsed.data.displayName,
        is_guest: parsed.data.isGuest,
        active: parsed.data.active,
        sort_order: parsed.data.sortOrder,
        linked_user_id: parsed.data.linkedUserId,
        created_by: userId,
      })
      .select("id, display_name")
      .single();

    if (error) return failure(error);

    revalidatePath(`/${slug}`, "layout");
    return success({ id: data.id, displayName: data.display_name });
  } catch (error) {
    return failure(error);
  }
}

/** Cadastro rápido durante o registro da partida (inclusive convidado). */
export async function createQuickPlayerAction(
  groupId: string,
  slug: string,
  input: { displayName: string; isGuest: boolean },
): Promise<ActionResult<{ id: string; displayName: string }>> {
  const parsed = quickPlayerSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  return createPlayerAction(groupId, slug, {
    displayName: parsed.data.displayName,
    isGuest: parsed.data.isGuest,
    active: true,
    sortOrder: 0,
    linkedUserId: null,
  });
}

export async function updatePlayerAction(
  playerId: string,
  slug: string,
  input: PlayerInput,
): Promise<ActionResult> {
  const parsed = playerSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("players")
      .update({
        display_name: parsed.data.displayName,
        is_guest: parsed.data.isGuest,
        active: parsed.data.active,
        sort_order: parsed.data.sortOrder,
        linked_user_id: parsed.data.linkedUserId,
      })
      .eq("id", playerId);

    if (error) return failure(error);
    revalidatePath(`/${slug}`, "layout");
    return success();
  } catch (error) {
    return failure(error);
  }
}

/** Desativar preserva o histórico; por isso não existe "excluir jogador". */
export async function setPlayerActiveAction(
  playerId: string,
  slug: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("players").update({ active }).eq("id", playerId);
    if (error) return failure(error);
    revalidatePath(`/${slug}`, "layout");
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function reorderPlayersAction(
  slug: string,
  order: { id: string; sortOrder: number }[],
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    for (const item of order) {
      const { error } = await supabase
        .from("players")
        .update({ sort_order: item.sortOrder })
        .eq("id", item.id);
      if (error) return failure(error);
    }
    revalidatePath(`/${slug}`, "layout");
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function updatePlayerNicknameAction(
  playerId: string,
  slug: string,
  input: { nickname: string | null },
): Promise<ActionResult> {
  const parsed = nicknameSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("players")
      .update({ nickname: parsed.data.nickname })
      .eq("id", playerId);
    if (error) return failure(error);
    revalidatePath(`/${slug}`, "layout");
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function setPlayerAvatarAction(
  playerId: string,
  slug: string,
  avatarUrl: string | null,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("players")
      .update({ avatar_url: avatarUrl })
      .eq("id", playerId);
    if (error) return failure(error);
    revalidatePath(`/${slug}`, "layout");
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function linkPlayerToUserAction(
  playerId: string,
  slug: string,
  userId: string | null,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("players")
      .update({ linked_user_id: userId })
      .eq("id", playerId);
    if (error) return failure(error);
    revalidatePath(`/${slug}`, "layout");
    return success();
  } catch (error) {
    return failure(error);
  }
}
