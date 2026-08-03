import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>;
}) {
  const { proximo } = await searchParams;

  return (
    <Card className="border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur-xl">
      <CardContent className="pt-4">
        <Suspense fallback={null}>
          <SignInForm nextPath={proximo ?? null} />
        </Suspense>
        <div className="mt-6 space-y-2 text-center text-sm text-white/70">
          <p>
            <Link href="/recuperar-senha" className="text-primary font-medium hover:underline">
              Esqueci minha senha
            </Link>
          </p>
          <p>
            Ainda não tem conta?{" "}
            <Link href="/criar-conta" className="text-primary font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
