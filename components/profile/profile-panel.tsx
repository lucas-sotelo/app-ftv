"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { signOutAction, updateProfileAction } from "@/lib/actions/auth";
import { profileSchema, type ProfileInput } from "@/lib/validations/auth";

export function ProfilePanel({ displayName, email }: { displayName: string; email: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sua conta</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={handleSubmit(async (values) => {
            const result = await updateProfileAction(values);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Perfil atualizado.");
            router.refresh();
          })}
        >
          <Field label="Nome" htmlFor="profile-name" error={errors.displayName?.message}>
            <Input
              id="profile-name"
              aria-invalid={!!errors.displayName}
              {...register("displayName")}
            />
          </Field>

          <Field
            label="E-mail"
            htmlFor="profile-email"
            hint="O e-mail de acesso não é alterado por aqui."
          >
            <Input id="profile-email" value={email} readOnly disabled />
          </Field>

          <Button type="submit" disabled={isSubmitting || !isDirty} className="self-start">
            {isSubmitting ? "Salvando…" : "Salvar"}
          </Button>
        </form>

        <form action={signOutAction}>
          <Button type="submit" variant="outline" block>
            <LogOut aria-hidden />
            Sair da conta
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
