import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function PlayerLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="h-6 w-40" />
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <ListSkeleton rows={5} />
    </div>
  );
}
