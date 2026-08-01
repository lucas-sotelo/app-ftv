"use client";

import { Key, PlusCircle } from "lucide-react";
import * as React from "react";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { JoinGroupDialog } from "@/components/groups/join-group-dialog";

export function OnboardingCards({ initialCode }: { initialCode: string }) {
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = React.useState(Boolean(initialCode));

  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        type="button"
        onClick={() => setCreateDialogOpen(true)}
        className="from-primary to-primary/80 text-primary-foreground flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br p-4 text-center shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
      >
        <PlusCircle className="size-6" aria-hidden />
        <span className="text-sm font-semibold">Criar grupo</span>
      </button>

      <button
        type="button"
        onClick={() => setJoinDialogOpen(true)}
        className="border-border/50 bg-card flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
      >
        <Key className="text-primary size-6" aria-hidden />
        <span className="text-sm font-semibold">Entrar com código</span>
      </button>

      <CreateGroupDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <JoinGroupDialog
        open={joinDialogOpen}
        onOpenChange={setJoinDialogOpen}
        initialCode={initialCode}
      />
    </div>
  );
}
