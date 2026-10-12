/**
 * Esqueleto de carga con la misma anatomía que el marco real (barra, título
 * grande, cards con elevación suave, barra inferior única): la página no
 * "salta" al cargar.
 */
export function ClientPageSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto max-w-lg">
        <div className="flex h-14 items-center justify-between pl-4 pr-3 pt-[env(safe-area-inset-top)]">
          <div className="h-9 w-9 animate-pulse rounded-medium bg-default-200" />
          <div className="flex gap-3">
            <div className="h-7 w-7 animate-pulse rounded-full bg-default-200" />
            <div className="h-7 w-7 animate-pulse rounded-full bg-default-200" />
          </div>
        </div>
        <div className="px-4 pb-5 pt-1">
          <div className="mb-2 h-4 w-24 animate-pulse rounded-small bg-default-200" />
          <div className="h-9 w-48 animate-pulse rounded-medium bg-default-200" />
        </div>
        <div className="space-y-4 px-4">
          {["w-32", "w-40", "w-28"].map((w) => (
            <div
              key={w}
              className="animate-pulse rounded-large bg-content1 p-5 shadow-small"
            >
              <div className={`mb-3 h-5 ${w} rounded-small bg-default-200`} />
              <div className="mb-2 h-4 w-full rounded-small bg-default-100" />
              <div className="h-4 w-3/4 rounded-small bg-default-100" />
            </div>
          ))}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 flex justify-center pb-[max(14px,calc(env(safe-area-inset-bottom)+10px))]">
        <div className="mx-3.5 h-16 w-full max-w-[440px] animate-pulse rounded-full bg-content1 shadow-medium" />
      </div>
    </div>
  );
}
