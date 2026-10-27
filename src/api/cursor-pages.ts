import { infiniteQueryOptions, type QueryKey } from "@tanstack/react-query"

/** The page every growing TradeNet list answers with: `nextCursor` is null on the last page. */
export type CursorPage<T> = { items: T[]; nextCursor: string | null }

/**
 * Query options for a cursor list, shown by DataTable as one long scroll.
 *
 * TanStack Query refreshes an infinite query by reloading every page loaded so far, one after another: 100
 * requests for 10,000 rows. So a list never refreshes on its own (window focus, network back), and it is
 * forgotten as soon as its screen closes (`gcTime: 0`): coming back loads the first page fresh, not all of them.
 */
export function cursorListOptions<T>(
  queryKey: QueryKey,
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<T>>
) {
  return infiniteQueryOptions({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
  })
}
