import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-40 w-full" />
      <ListSkeleton rows={3} />
    </div>
  );
}
