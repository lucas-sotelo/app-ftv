"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { updatePasswordAction } from "@/lib/actions/auth";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";

export default function NewPasswordPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  return (
    <Card>
      <CardContent className="pt-4">
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={handleSubmit(async (values) => {
            const result = await updatePasswordAction(values);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Senha atualizada.");
            router.push("/");
            router.refresh();
          })}
        >
          <p className="text-muted-foreground text-sm">Escolha uma nova senha para sua conta.</p>

          <Field
            label="Nova senha"
            htmlFor="password"
            hint="Pelo menos 8 caracteres."
            error={errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              aria-invalid={!!errors.password}
              {...register("password")}
            />
          </Field>

          <Field
            label="Confirmar nova senha"
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
            {isSubmitting ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
