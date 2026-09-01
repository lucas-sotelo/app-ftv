import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function MonthlyChampionsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48" />
      <ListSkeleton rows={6} />
    </div>
  );
}
