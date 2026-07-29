import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listUserGroups } from "@/lib/data/groups";
import { createClient } from "@/lib/supabase/server";
import { OnboardingCards } from "./onboarding-cards";

export const metadata: Metadata = { title: "Começar" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { convite } = await searchParams;
  const groups = await listUserGroups(supabase);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={56}
          height={56}
          className="rounded-[var(--radius-app)] shadow-sm"
        />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Vamos começar</h1>
          <p className="text-muted-foreground text-sm">
            Crie um grupo para o seu pessoal ou entre em um grupo existente com o código do convite.
          </p>
        </div>
      </div>

      <OnboardingCards initialCode={convite ?? ""} />

      {groups.length > 0 ? (
        <p className="text-muted-foreground text-center text-sm">
          <Link
            href={`/${groups[0].group.slug}`}
            className="text-primary font-medium hover:underline"
          >
            Voltar para {groups[0].group.name}
          </Link>
        </p>
      ) : null}
    </main>
  );
}
