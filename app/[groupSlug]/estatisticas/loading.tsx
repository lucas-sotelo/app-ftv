import { BallSpinner } from "@/components/ui/ball-spinner";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function StatsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center py-1">
        <BallSpinner />
      </div>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-11 w-full" />
      <ListSkeleton rows={8} />
    </div>
  );
}
