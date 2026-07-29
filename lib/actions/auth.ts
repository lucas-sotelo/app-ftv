"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  profileSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordInput,
  type ProfileInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validations/auth";
import { failure, isNextControlFlowError, success, type ActionResult } from "./result";

/**
 * Só aceita caminho interno. Impede que `?proximo=https://site-malicioso`
 * vire um open redirect depois do login.
 */
function safeRedirectPath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function signInAction(
  input: SignInInput,
  nextPath?: string | null,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      return {
        ok: false,
        error:
          error.status === 400
            ? "E-mail ou senha incorretos."
            : "Não foi possível entrar. Tente novamente.",
      };
    }
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    return failure(error);
  }

  redirect(safeRedirectPath(nextPath));
}

export async function signUpAction(
  input: SignUpInput,
): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        // display_name é só exibição — nenhum papel/permissão vem daqui.
        data: { display_name: parsed.data.displayName },
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
      },
    });

    if (error) {
      if (error.status === 422 || /already registered/i.test(error.message)) {
        return { ok: false, error: "Já existe uma conta com esse e-mail." };
      }
      return failure(error);
    }

    return success({ needsEmailConfirmation: !data.session });
  } catch (error) {
    return failure(error);
  }
}

export async function signOutAction(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export async function requestPasswordResetAction(
  input: ForgotPasswordInput,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${getAppUrl()}/auth/callback?proximo=/nova-senha`,
    });
    // Resposta idêntica exista ou não a conta: não entregamos quem tem cadastro.
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function updatePasswordAction(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return failure(error);
    return success();
  } catch (error) {
    return failure(error);
  }
}

export async function updateProfileAction(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return failure(new Error(parsed.error.issues[0].message));

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: parsed.data.displayName })
      .eq("id", user.id);

    if (error) return failure(error);
    revalidatePath("/", "layout");
    return success();
  } catch (error) {
    return failure(error);
  }
}
