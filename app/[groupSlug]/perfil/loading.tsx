import { BallSpinner } from "@/components/ui/ball-spinner";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center py-1">
        <BallSpinner />
      </div>
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-40 w-full" />
      <ListSkeleton rows={3} />
    </div>
  );
}
