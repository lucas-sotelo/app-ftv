import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DailyKings } from "@/components/resenha/daily-kings";
import { Massacres } from "@/components/resenha/massacres";
import { Streaks } from "@/components/resenha/streaks";
import { Underdogs } from "@/components/resenha/underdogs";
import { getGroupContext } from "@/lib/data/groups";
import {
  fetchBiggestMassacres,
  fetchDailyKings,
  fetchDailyLanterns,
  fetchPairUnderdogs,
  fetchPlayerStreaks,
} from "@/lib/data/resenha";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Resenha" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ResenhaPage({
  params,
}: {
  params: Promise<{ groupSlug: string }>;
}) {
  const { groupSlug } = await params;
  const supabase = await createClient();
  const context = await getGroupContext(supabase, groupSlug);
  if (!context) notFound();

  const { group } = context;

  const [kings, lanterns, streaks, underdogs, massacres] = await Promise.all([
    fetchDailyKings(supabase, group.id),
    fetchDailyLanterns(supabase, group.id),
    fetchPlayerStreaks(supabase, group.id),
    fetchPairUnderdogs(supabase, group.id),
    fetchBiggestMassacres(supabase, group.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Resenha</h1>
      <DailyKings kings={kings} lanterns={lanterns} />
      <Streaks streaks={streaks} />
      <Underdogs underdogs={underdogs} timezone={group.timezone} />
      <Massacres massacres={massacres} />
    </div>
  );
}
