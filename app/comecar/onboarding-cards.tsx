"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ticket, Volleyball } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { createGroupAction, joinGroupAction } from "@/lib/actions/groups";
import {
  createGroupSchema,
  joinGroupSchema,
  type CreateGroupInput,
  type CreateGroupValues,
  type JoinGroupInput,
  type JoinGroupValues,
} from "@/lib/validations/group";

export function OnboardingCards({ initialCode }: { initialCode: string }) {
  const router = useRouter();

  const createForm = useForm<CreateGroupValues, unknown, CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: "", timezone: "America/Sao_Paulo" },
  });

  const joinForm = useForm<JoinGroupValues, unknown, JoinGroupInput>({
    resolver: zodResolver(joinGroupSchema),
    defaultValues: { code: initialCode },
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volleyball className="text-court-600 size-5" aria-hidden />
            Criar um grupo
          </CardTitle>
          <CardDescription>
            Você fica como proprietário e pode convidar o resto do pessoal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={createForm.handleSubmit(async (values) => {
              const result = await createGroupAction(values);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Grupo criado!");
              router.push(`/${result.data.slug}`);
              router.refresh();
            })}
          >
            <Field
              label="Nome do grupo"
              htmlFor="group-name"
              error={createForm.formState.errors.name?.message}
            >
              <Input
                id="group-name"
                placeholder="Futevôlei da praia"
                aria-invalid={!!createForm.formState.errors.name}
                {...createForm.register("name")}
              />
            </Field>
            <Button type="submit" block disabled={createForm.formState.isSubmitting}>
              {createForm.formState.isSubmitting ? "Criando…" : "Criar grupo"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="text-primary size-5" aria-hidden />
            Entrar com convite
          </CardTitle>
          <CardDescription>Cole o código que o administrador do grupo enviou.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={joinForm.handleSubmit(async (values) => {
              const result = await joinGroupAction(values);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Você entrou no grupo!");
              router.push(`/${result.data.slug}`);
              router.refresh();
            })}
          >
            <Field
              label="Código do convite"
              htmlFor="invite-code"
              error={joinForm.formState.errors.code?.message}
            >
              <Input
                id="invite-code"
                placeholder="ABC123XYZ"
                autoCapitalize="characters"
                className="font-mono tracking-widest uppercase"
                aria-invalid={!!joinForm.formState.errors.code}
                {...joinForm.register("code")}
              />
            </Field>
            <Button
              type="submit"
              variant="outline"
              block
              disabled={joinForm.formState.isSubmitting}
            >
              {joinForm.formState.isSubmitting ? "Entrando…" : "Entrar no grupo"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
