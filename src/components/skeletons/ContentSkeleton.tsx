/**
 * Generic content skeleton for list/card layouts.
 */
export function ContentSkeleton({ rows = 5, showCards = true }: { rows?: number; showCards?: boolean }) {
  return (
    <div className="animate-pulse space-y-6">
      {showCards && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
