const PAGE = 1000; // PostgREST max-rows

type PageResult<T> = PromiseLike<{
  data: T[] | null;
  error: unknown;
  count?: number | null;
}>;

/**
 * Read every row of a query. PostgREST silently caps a response at 1000 rows,
 * so admin aggregates must not trust a single request. The first page asks
 * for an exact count; the rest are fetched in parallel — the DB is a
 * transatlantic round trip away, so sequential paging cost ~300ms per page.
 *
 * `page(from, to, withCount)` must apply a stable `.order()` and
 * `.range(from, to)`, and pass `{ count: "exact" }` to `.select()` when
 * `withCount` is true.
 */
export async function fetchAll<T>(
  page: (from: number, to: number, withCount: boolean) => PageResult<T>
): Promise<T[]> {
  const first = await page(0, PAGE - 1, true);

  if (first.error) throw first.error;
  const rows = first.data ?? [];
  const total = first.count ?? rows.length;

  if (rows.length >= total || rows.length < PAGE) return rows;

  const rest = await Promise.all(
    Array.from({ length: Math.ceil(total / PAGE) - 1 }, (_, i) =>
      page((i + 1) * PAGE, (i + 2) * PAGE - 1, false)
    )
  );

  for (const r of rest) {
    if (r.error) throw r.error;
    rows.push(...(r.data ?? []));
  }

  return rows;
}
