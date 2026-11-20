export default function DashboardSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-busy="true" aria-label="Loading dashboard">
      <span className="sr-only">Loading dashboard…</span>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="skeleton h-7 w-44 rounded-lg" />
          <div className="skeleton h-4 w-32 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="skeleton h-9 w-36 rounded-xl" />
          <div className="skeleton h-10 w-32 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="ap-surface p-4 space-y-3" aria-hidden="true">
            <div className="flex items-start justify-between">
              <div className="skeleton w-9 h-9 rounded-[11px]" />
              <div className="skeleton h-5 w-12 rounded-full" />
            </div>
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-7 w-3/4 rounded-lg" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="ap-surface p-3.5 flex items-center gap-3" aria-hidden="true">
            <div className="skeleton w-9 h-9 rounded-[11px] flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-5 w-12 rounded" />
              <div className="skeleton h-3 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="ap-surface p-5 space-y-3" aria-hidden="true">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-6 w-32 rounded-lg" />
            <div className="skeleton h-24 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <div className="ap-surface p-4 space-y-2.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="skeleton w-7 h-7 rounded-full flex-shrink-0" />
            <div className="skeleton h-3.5 flex-1 rounded" />
            <div className="skeleton h-3.5 w-16 rounded hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  )
}
