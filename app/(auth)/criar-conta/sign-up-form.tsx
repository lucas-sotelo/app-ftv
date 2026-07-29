"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { signUpAction } from "@/lib/actions/auth";
import { signUpSchema, type SignUpInput } from "@/lib/validations/auth";

export function SignUpForm() {
  const router = useRouter();
  const [awaitingEmail, setAwaitingEmail] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "", confirmPassword: "" },
  });

  if (awaitingEmail) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <MailCheck className="text-court-600 size-8" aria-hidden />
        <h2 className="font-semibold">Confirme seu e-mail</h2>
        <p className="text-muted-foreground text-sm">
          Enviamos um link de confirmação. Depois de confirmar, é só entrar.
        </p>
        <Button variant="outline" block onClick={() => router.push("/entrar")}>
          Ir para o login
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        const result = await signUpAction(values);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (result.data.needsEmailConfirmation) {
          setAwaitingEmail(true);
          return;
        }
        toast.success("Conta criada!");
        router.push("/");
        router.refresh();
      })}
    >
      <Field label="Seu nome" htmlFor="displayName" error={errors.displayName?.message}>
        <Input
          id="displayName"
          autoComplete="name"
          autoFocus
          aria-invalid={!!errors.displayName}
          {...register("displayName")}
        />
      </Field>

      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </Field>

      <Field
        label="Senha"
        htmlFor="password"
        hint="Pelo menos 8 caracteres."
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </Field>

      <Field
        label="Confirmar senha"
        htmlFor="confirmPassword"
        error={errors.confirmPassword?.message}
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
      </Field>

      <Button type="submit" size="lg" block disabled={isSubmitting}>
        {isSubmitting ? "Criando…" : "Criar conta"}
      </Button>
    </form>
  );
}
