"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/lib/actions/auth";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  return (
    <Card>
      <CardContent className="pt-4">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <MailCheck className="text-court-600 size-8" aria-hidden />
            <h2 className="font-semibold">Verifique seu e-mail</h2>
            <p className="text-muted-foreground text-sm">
              Se existir uma conta com esse endereço, enviamos um link para criar uma nova senha.
            </p>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={handleSubmit(async (values) => {
              const result = await requestPasswordResetAction(values);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setSent(true);
            })}
          >
            <p className="text-muted-foreground text-sm">
              Informe seu e-mail e enviaremos um link para criar uma nova senha.
            </p>
            <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                aria-invalid={!!errors.email}
                {...register("email")}
              />
            </Field>
            <Button type="submit" size="lg" block disabled={isSubmitting}>
              {isSubmitting ? "Enviando…" : "Enviar link"}
            </Button>
          </form>
        )}

        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Link href="/entrar" className="text-primary font-medium hover:underline">
            Voltar para o login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
