import { BallSpinner } from "@/components/ui/ball-spinner";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResenhaLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center py-1">
        <BallSpinner />
      </div>
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
