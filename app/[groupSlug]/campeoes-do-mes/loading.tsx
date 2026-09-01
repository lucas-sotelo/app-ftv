import { BallSpinner } from "@/components/ui/ball-spinner";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function MonthlyChampionsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center py-1">
        <BallSpinner />
      </div>
      <Skeleton className="h-7 w-48" />
      <ListSkeleton rows={6} />
    </div>
  );
}
