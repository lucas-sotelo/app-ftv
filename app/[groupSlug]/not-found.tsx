import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GroupNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <SearchX className="text-muted-foreground size-10" aria-hidden />
      <h1 className="text-xl font-bold">Grupo não encontrado</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Ou o endereço está errado, ou você não faz parte deste grupo. Peça um convite a quem
        administra.
      </p>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
