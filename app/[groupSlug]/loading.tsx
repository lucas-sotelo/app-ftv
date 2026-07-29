import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function GroupLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="col-span-2 h-20" />
      </div>
      <ListSkeleton rows={3} />
    </div>
  );
}
