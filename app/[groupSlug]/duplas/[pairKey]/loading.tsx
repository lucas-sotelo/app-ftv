import { BallSpinner } from "@/components/ui/ball-spinner";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function PairLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center py-1">
        <BallSpinner />
      </div>
      <Skeleton className="h-7 w-52" />
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
