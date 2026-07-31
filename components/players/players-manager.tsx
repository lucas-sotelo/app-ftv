"use client";

import { Camera, ChevronDown, ChevronUp, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { QuickPlayerDialog } from "@/components/matches/quick-player-dialog";
import { PlayerAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  linkPlayerToUserAction,
  reorderPlayersAction,
  setPlayerActiveAction,
  setPlayerAvatarAction,
  updatePlayerNicknameAction,
} from "@/lib/actions/players";
import type { GroupMemberEntry } from "@/lib/data/groups";
import type { PlayerRow } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const UNLINKED = "__nenhum__";

export function PlayersManager({
  players,
  members,
  groupId,
  slug,
}: {
  players: PlayerRow[];
  members: GroupMemberEntry[];
  groupId: string;
  slug: string;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [uploadingAvatarId, setUploadingAvatarId] = React.useState<string | null>(null);
  const avatarTargetId = React.useRef<string | null>(null);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const triggerAvatarUpload = (playerId: string) => {
    avatarTargetId.current = playerId;
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const playerId = avatarTargetId.current;
    if (!file || !playerId) return;

    setUploadingAvatarId(playerId);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${groupId}/${playerId}-${Date.now().toString(36)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (uploadError) {
        toast.error("Não foi possível enviar a foto.");
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const result = await setPlayerAvatarAction(playerId, slug, data.publicUrl);
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível salvar a foto.");
        return;
      }
      toast.success("Foto atualizada.");
      router.refresh();
    } finally {
      setUploadingAvatarId(null);
    }
  };

  const run = async (
    id: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    message: string,
  ) => {
    setBusy(id);
    try {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível concluir.");
        return;
      }
      toast.success(message);
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  // Trocar de posição só reescreve os dois vizinhos afetados.
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= players.length) return;
    const a = players[index];
    const b = players[target];
    await run(
      a.id,
      () =>
        reorderPlayersAction(slug, [
          { id: a.id, sortOrder: b.sort_order === a.sort_order ? target : b.sort_order },
          { id: b.id, sortOrder: b.sort_order === a.sort_order ? index : a.sort_order },
        ]),
      "Ordem atualizada.",
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => setDialogOpen(true)} className="self-start">
        <Plus aria-hidden />
        Novo jogador
      </Button>

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      />

      {players.length === 0 ? (
        <EmptyState
          icon={<UserRound className="size-8" aria-hidden />}
          title="Nenhum jogador cadastrado"
          description="Cadastre pelo menos quatro jogadores para começar a registrar partidas."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {players.map((player, index) => (
            <li
              key={player.id}
              className="bg-card flex flex-col gap-2 rounded-[var(--radius-app)] border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <PlayerAvatar
                    name={player.display_name}
                    seed={player.id}
                    imageUrl={player.avatar_url}
                  />
                  <button
                    type="button"
                    aria-label={`Trocar foto de ${player.display_name}`}
                    disabled={uploadingAvatarId === player.id}
                    onClick={() => triggerAvatarUpload(player.id)}
                    className={cn(
                      "bg-primary text-primary-foreground border-card absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border",
                      uploadingAvatarId === player.id && "opacity-60",
                    )}
                  >
                    <Camera className="size-2.5" aria-hidden />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${slug}/jogadores/${player.id}`}
                    className="truncate text-sm font-medium hover:underline"
                    prefetch={false}
                  >
                    {player.display_name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {player.is_guest ? <Badge variant="outline">Convidado</Badge> : null}
                    {!player.active ? <Badge variant="warning">Inativo</Badge> : null}
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Mover ${player.display_name} para cima`}
                    disabled={index === 0 || busy !== null}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Mover ${player.display_name} para baixo`}
                    disabled={index === players.length - 1 || busy !== null}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown aria-hidden />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor={`nickname-${player.id}`} className="text-muted-foreground text-xs">
                  Apelido (opcional)
                </label>
                <Input
                  id={`nickname-${player.id}`}
                  defaultValue={player.nickname ?? ""}
                  placeholder="Ex.: Formiga"
                  maxLength={30}
                  disabled={busy === player.id}
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value === (player.nickname ?? "")) return;
                    run(
                      player.id,
                      () =>
                        updatePlayerNicknameAction(player.id, slug, { nickname: value || null }),
                      "Apelido atualizado.",
                    );
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={player.active}
                    disabled={busy === player.id}
                    onCheckedChange={(checked) =>
                      run(
                        player.id,
                        () => setPlayerActiveAction(player.id, slug, checked),
                        checked ? "Jogador reativado." : "Jogador desativado.",
                      )
                    }
                    aria-label={`${player.active ? "Desativar" : "Reativar"} ${player.display_name}`}
                  />
                  <span>{player.active ? "Ativo" : "Inativo"}</span>
                </label>

                <Select
                  value={player.linked_user_id ?? UNLINKED}
                  onValueChange={(value) =>
                    run(
                      player.id,
                      () =>
                        linkPlayerToUserAction(player.id, slug, value === UNLINKED ? null : value),
                      "Vínculo atualizado.",
                    )
                  }
                >
                  <SelectTrigger
                    className="w-auto min-w-44"
                    aria-label={`Conta vinculada a ${player.display_name}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNLINKED}>Sem conta vinculada</SelectItem>
                    {members.map((member) => (
                      <SelectItem
                        key={member.userId}
                        value={member.userId}
                        disabled={
                          member.linkedPlayerId !== null && member.linkedPlayerId !== player.id
                        }
                      >
                        {member.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-xs">
        Jogadores não são apagados: desativar preserva todo o histórico de partidas. Um jogador
        inativo não pode ser escalado em partidas novas.
      </p>

      <QuickPlayerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        groupId={groupId}
        slug={slug}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}
