import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function StatsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-11 w-full" />
      <ListSkeleton rows={8} />
    </div>
  );
}
