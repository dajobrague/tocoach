/**
 * Esqueleto de carga con la misma anatomía que el marco real (barra, cards
 * con elevación suave, nav flotante): la página no "salta" al cargar.
 */
export function ClientPageSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="mx-auto max-w-lg">
        <div className="flex h-14 items-center gap-3 border-b border-default-200 px-4">
          <div className="h-8 w-8 animate-pulse rounded-medium bg-default-200" />
          <div className="h-4 w-28 animate-pulse rounded-small bg-default-200" />
        </div>
        <div className="space-y-4 px-4 pt-4">
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
      <div className="fixed inset-x-0 bottom-0 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="h-16 w-[min(22rem,calc(100%-2rem))] animate-pulse rounded-full bg-content1 shadow-medium" />
      </div>
    </div>
  );
}
