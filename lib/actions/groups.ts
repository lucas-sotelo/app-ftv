"use server";

import { revalidatePath } from "next/cache";
import type { GroupRole } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  createGroupSchema,
  createInvitationSchema,
  groupSettingsSchema,
  joinGroupSchema,
  type CreateGroupInput,
  type CreateInvitationInput,
  type GroupSettingsInput,
  type JoinGroupInput,
} from "@/lib/validations/group";
import { failure, success, type ActionResult } from "./result";

export async function createGroupAction(
  input: CreateGroupInput,
): Promise<ActionResult<{ slug: string; id: string }>> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    // Grupo + membro owner numa transação só: nunca sobra grupo sem dono.
    // Fuso horário nunca vem do usuário no fluxo de criação: o banco exige
    // o campo, mas todo grupo novo usa o mesmo fuso.
    const { data, error } = await supabase.rpc("create_group_with_owner", {
      p_name: parsed.data.name,
      p_timezone: "America/Sao_Paulo",
    });
    if (error) return failure(error);

    revalidatePath("/", "layout");
    return success({ slug: data.slug, id: data.id });
  } catch (error) {
    return failure(error);
  }
}

/**
 * Grava a foto do grupo logo após a criação. Separado de createGroupAction
 * porque o upload no Storage só é permitido depois que o grupo existe: o
 * bucket usa `{group_id}/...` e a policy exige is_group_admin(group_id).
 */
export async function setGroupAvatarAction(
  groupId: string,
  slug: string,
  avatarUrl: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("groups")
      .update({ avatar_url: avatarUrl })
      .eq("id", groupId);
    if (error) return failure(error);

    revalidatePath(`/${slug}`, "layout");
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function joinGroupAction(
  input: JoinGroupInput,
): Promise<ActionResult<{ slug: string }>> {
  const parsed = joinGroupSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("redeem_group_invitation", {
      p_code: parsed.data.code,
    });
    if (error) return failure(error);

    revalidatePath("/", "layout");
    return success({ slug: data.slug });
  } catch (error) {
    return failure(error);
  }
}

export async function updateGroupSettingsAction(
  groupId: string,
  slug: string,
  input: GroupSettingsInput,
): Promise<ActionResult> {
  const parsed = groupSettingsSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("groups")
      .update({
        name: parsed.data.name,
        min_attendance_percent: parsed.data.minAttendancePercent,
        avatar_url: parsed.data.avatarUrl,
        first_place_emoji: parsed.data.firstPlaceEmoji,
        last_place_emoji: parsed.data.lastPlaceEmoji,
      })
      .eq("id", groupId);

    if (error) return failure(error);
    revalidatePath(`/${slug}`, "layout");
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function createInvitationAction(
  groupId: string,
  slug: string,
  input: CreateInvitationInput,
): Promise<ActionResult<{ code: string }>> {
  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    const expiresAt = parsed.data.expiresInDays
      ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString()
      : null;

    const { data, error } = await supabase.rpc("create_group_invitation", {
      p_group_id: groupId,
      p_role: parsed.data.role,
      p_expires_at: expiresAt,
      p_max_uses: parsed.data.maxUses,
    });
    if (error) return failure(error);

    revalidatePath(`/${slug}/grupo`);
    return success({ code: data.code });
  } catch (error) {
    return failure(error);
  }
}

export async function revokeInvitationAction(
  invitationId: string,
  slug: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("revoke_group_invitation", {
      p_invitation_id: invitationId,
    });
    if (error) return failure(error);
    revalidatePath(`/${slug}/grupo`);
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function setMemberRoleAction(
  groupId: string,
  slug: string,
  userId: string,
  role: GroupRole,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_member_role", {
      p_group_id: groupId,
      p_user_id: userId,
      p_role: role,
    });
    if (error) return failure(error);
    revalidatePath(`/${slug}/grupo`);
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function removeMemberAction(
  groupId: string,
  slug: string,
  userId: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    // A trigger do banco impede que o último owner saia.
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);

    if (error) return failure(error);
    revalidatePath(`/${slug}/grupo`);
    return success();
  } catch (error) {
    return failure(error);
  }
}
