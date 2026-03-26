/**
 * Skeleton for dashboard-style pages (Seller, Buyer, Admin).
 * Sidebar + header + content grid.
 */
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 flex animate-pulse">
      {/* Sidebar */}
      <div className="hidden lg:block w-72 bg-[#250e52] p-4 space-y-2">
        <div className="h-10 w-32 bg-[#3d1a7a]/50 rounded mx-auto mb-6" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-[#3d1a7a]/30 rounded-xl" />
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 lg:ml-72">
        <header className="h-14 md:h-16 bg-white border-b border-gray-200 px-4 flex items-center justify-between">
          <div className="h-6 w-40 bg-muted rounded" />
          <div className="flex gap-3">
            <div className="h-9 w-9 bg-muted rounded-full" />
            <div className="h-10 w-10 bg-muted rounded-full" />
          </div>
        </header>
        <main className="p-4 md:p-6">
          <div className="h-8 w-48 bg-muted rounded mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-xl" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
