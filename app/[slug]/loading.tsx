export default function ClientLoading() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto">
        {/* Header Skeleton */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-default-200 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-default-200 rounded animate-pulse" />
                <div className="h-3 w-16 bg-default-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-default-200 animate-pulse" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="px-4 space-y-4">
          {/* Card skeleton 1 */}
          <div className="bg-default-100 rounded-xl p-5 animate-pulse">
            <div className="h-5 w-32 bg-default-200 rounded mb-3" />
            <div className="h-4 w-full bg-default-200 rounded mb-2" />
            <div className="h-4 w-3/4 bg-default-200 rounded" />
          </div>

          {/* Card skeleton 2 */}
          <div className="bg-default-100 rounded-xl p-5 animate-pulse">
            <div className="h-5 w-40 bg-default-200 rounded mb-3" />
            <div className="h-4 w-full bg-default-200 rounded mb-2" />
            <div className="h-4 w-2/3 bg-default-200 rounded" />
          </div>

          {/* Card skeleton 3 */}
          <div className="bg-default-100 rounded-xl p-5 animate-pulse">
            <div className="h-5 w-28 bg-default-200 rounded mb-3" />
            <div className="h-4 w-full bg-default-200 rounded mb-2" />
            <div className="h-4 w-1/2 bg-default-200 rounded" />
          </div>
        </div>
      </div>

      {/* Bottom Nav Skeleton */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-default-200 z-50">
        <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1 py-1">
              <div className="w-6 h-6 bg-default-200 rounded animate-pulse" />
              <div className="h-2 w-10 bg-default-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
