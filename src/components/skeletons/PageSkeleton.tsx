/**
 * Full-page loading skeleton for route transitions.
 * Mimics a typical page layout: header + content area.
 */
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      {/* Header bar */}
      <div className="h-14 md:h-16 border-b border-border bg-card px-4 md:px-8 flex items-center justify-between">
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-24 bg-muted rounded-lg hidden sm:block" />
          <div className="h-10 w-10 bg-muted rounded-full" />
        </div>
      </div>

      {/* Content area */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Page title */}
        <div className="h-8 w-48 bg-muted rounded" />

        {/* Cards row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl" />
          ))}
        </div>

        {/* Content blocks */}
        <div className="space-y-4">
          <div className="h-6 w-36 bg-muted rounded" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
