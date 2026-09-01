import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function GroupSettingsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
      <Skeleton className="h-40 w-full" />
      <ListSkeleton rows={3} />
    </div>
  );
}
