interface PageSkeletonLoaderProps {
  variant: 'overview' | 'apps' | 'security' | 'tags' | 'signup' | 'home';
  withHeaderShell?: boolean;
}

export function PageSkeletonLoader({
  variant,
  withHeaderShell = false,
}: PageSkeletonLoaderProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading page content"
      className={withHeaderShell ? 'min-h-screen bg-[#F8FAFC] flex flex-col' : 'space-y-8'}
    >
      {withHeaderShell && (
        <div className="bg-white border-b border-slate-200 h-16 px-4 sm:px-6 flex items-center justify-between">
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="hidden md:flex items-center gap-6">
            <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-12 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="h-9 w-28 bg-slate-200 rounded-lg animate-pulse" />
        </div>
      )}

      <div
        className={
          withHeaderShell
            ? 'max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-8 space-y-8'
            : 'space-y-8'
        }
      >
        {/* Top summary / banner card skeleton */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {variant === 'overview' && (
                <div className="w-16 h-16 rounded-2xl bg-slate-200 animate-pulse shrink-0" />
              )}
              <div className="space-y-2.5">
                <div className="h-6 w-56 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-80 max-w-full bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="h-10 w-32 bg-slate-100 rounded-xl animate-pulse shrink-0" />
          </div>

          {variant === 'overview' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-slate-100">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="space-y-2">
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                  <div className="h-7 w-12 bg-slate-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content cards / list items skeleton */}
        {variant === 'apps' || variant === 'tags' ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="py-4 border-b border-slate-100 last:border-b-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                  <div className="space-y-2">
                    <div className="h-4 w-44 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-72 max-w-full bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-52 bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-24 bg-slate-100 rounded-lg animate-pulse" />
                  <div className="h-8 w-20 bg-slate-100 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
              <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
              </div>
              <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
              </div>
              <div className="h-11 w-36 bg-slate-200 rounded-xl animate-pulse ml-auto" />
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
                {[1, 2, 3, 4].map((row) => (
                  <div
                    key={row}
                    className="h-9 bg-slate-100 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
