import {
  infiniteQueryOptions,
  queryOptions,
  type QueryKey,
} from "@tanstack/react-query"

import { ApiError } from "./errors"

/**
 * The page every TradeNet list answers with: `nextCursor` is null on the last page. A short list (stores, groups,
 * sessions) is answered whole, as one page whose `nextCursor` is null.
 */
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

/**
 * Query options for a short list TradeNet answers whole (stores, categories, price types, groups, sessions): the
 * rows themselves, for a table (`useArraySource`), a select or a lookup. Should the server ever start paging such a
 * list, the screen says so (an unexpected answer) instead of quietly showing the first page as all of it.
 */
export function wholeListOptions<T>(
  queryKey: QueryKey,
  fetchPage: () => Promise<CursorPage<T>>
) {
  return queryOptions({
    queryKey,
    queryFn: async () => {
      const page = await fetchPage()
      if (page.nextCursor !== null)
        throw new ApiError(200, "UNEXPECTED_RESPONSE")
      return page.items
    },
  })
}
