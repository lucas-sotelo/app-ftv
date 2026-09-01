import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function MatchesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-11 w-full" />
      <ListSkeleton rows={6} />
    </div>
  );
}
