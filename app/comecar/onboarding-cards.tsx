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
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl p-4 text-center shadow-sm transition-colors"
      >
        <PlusCircle className="size-6" aria-hidden />
        <span className="text-sm font-semibold">Criar grupo</span>
      </button>

      <button
        type="button"
        onClick={() => setJoinDialogOpen(true)}
        className="border-border bg-card hover:bg-muted flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center shadow-sm transition-colors"
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
