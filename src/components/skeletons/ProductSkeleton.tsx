/**
 * Skeleton for product/store detail pages.
 */
export function ProductSkeleton() {
  return (
    <div className="animate-pulse max-w-7xl mx-auto p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image area */}
        <div className="aspect-square bg-muted rounded-xl" />
        {/* Details */}
        <div className="space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-6 w-24 bg-muted rounded" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </div>
          <div className="h-12 w-full bg-muted rounded-lg mt-6" />
        </div>
      </div>
    </div>
  );
}
