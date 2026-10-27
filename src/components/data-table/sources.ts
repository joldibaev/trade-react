import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query"
import { useMemo } from "react"

import type { CursorPage } from "@/api/cursor-pages"

/** What DataTable shows: the rows so far, how the first load went, and how the next page goes. */
export type DataTableSource<T> = {
  rows: readonly T[]
  /** Another value means another list (a new search, a filter): the table goes back to its top. */
  listIdentity: unknown
  isPending: boolean
  /** The first load failed: there is nothing to show but this error. */
  loadError: unknown
  retryLoad: () => void
  hasMore: boolean
  isLoadingMore: boolean
  /** The next page failed: the rows stay, the error shows under them. Null when it did not. */
  moreError: unknown
  loadMore: () => void
}

const noRows: never[] = []
const nothing = () => undefined

/** A growing TradeNet list (`cursorListOptions`, src/api/cursor-pages.ts), page after page as the end comes near. */
export function useCursorSource<T>(
  query: UseInfiniteQueryResult<InfiniteData<CursorPage<T>>>
): DataTableSource<T> {
  const { data } = query
  const rows = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? noRows,
    [data]
  )
  return {
    rows,
    // Loading more keeps the first page as it was; a new search or filter brings another one.
    listIdentity: data?.pages[0],
    isPending: query.isPending,
    loadError: query.isError && !data ? query.error : null,
    retryLoad: () => void query.refetch(),
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    moreError: query.isFetchNextPageError ? query.error : null,
    loadMore: () => void query.fetchNextPage(),
  }
}

/** A short list the API answers whole (stores, price types, groups, sessions). */
export function useArraySource<T>(
  query: UseQueryResult<T[]>
): DataTableSource<T> {
  return {
    rows: query.data ?? noRows,
    // A short list is not worth a jump to the top when it reloads after an edit.
    listIdentity: null,
    isPending: query.isPending,
    loadError: query.isError && !query.data ? query.error : null,
    retryLoad: () => void query.refetch(),
    hasMore: false,
    isLoadingMore: false,
    moreError: null,
    loadMore: nothing,
  }
}

/** Rows that came inside another answer (a store's cashboxes): nothing to load, nothing more to come. */
export function loadedSource<T>(rows: readonly T[]): DataTableSource<T> {
  return {
    rows,
    listIdentity: null,
    isPending: false,
    loadError: null,
    retryLoad: nothing,
    hasMore: false,
    isLoadingMore: false,
    moreError: null,
    loadMore: nothing,
  }
}
