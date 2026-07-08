import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ClassDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading class">
      <div className="flex flex-col items-center text-center">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
        <Skeleton className="mt-4 h-9 w-full max-w-md rounded-xl" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="flex min-h-0 flex-col lg:max-h-[min(70vh,40rem)]">
          <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col lg:max-h-[min(70vh,40rem)]">
          <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
