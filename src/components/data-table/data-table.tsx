import {
  flexRender,
  useTable,
  type Cell,
  type Header,
  type RowData,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "cn"

import { ProblemAlert } from "@/components/problem-alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useT } from "@/i18n/i18n"

import { dataTableFeatures, type DataTableColumns } from "./columns"
import type { DataTableSource } from "./sources"

type DataTableProps<T extends { id: string | number }> = {
  /** The table's accessible name, usually the page title. */
  label: string
  columns: DataTableColumns<T>
  /** `useCursorSource(useInfiniteQuery(...))` or `useArraySource(useQuery(...))` (./sources.ts). */
  source: DataTableSource<T>
  /** Shown instead of the table when the list has no rows. */
  empty: ReactNode
  className?: string
}

// One fixed row height keeps 10,000 rows smooth: no measuring while scrolling. Cells truncate instead of wrapping,
// and lose their vertical padding so the row is exactly this tall (44px is also a comfortable finger target).
const rowHeight = 44
// The next page is requested when this many rows remain below the visible ones.
const prefetchRows = 30
const skeletonRows = 8

/**
 * Every list of the app: a native <table> (screen readers read it as a table) that renders only the rows in view,
 * with spacer rows above and below, and loads the next cursor page as the end comes near.
 *
 * - First load: skeleton rows under real headers. First page failed: the error with "Повторить" instead of the table.
 * - A failed next page keeps the loaded rows, shows the error below them, and waits for "Повторить":
 *   scrolling never repeats a failed request on its own.
 */
export function DataTable<T extends { id: string | number }>({
  label,
  columns,
  source,
  empty,
  className,
}: DataTableProps<T>) {
  const t = useT()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { rows, hasMore, isLoadingMore, moreError, loadMore } = source
  const moreFailed = moreError !== null

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    // Rows are keyed by the API's id: a string, or a number for append-only logs (price history, audit).
    getRowId: (row) => String(row.id),
  })
  const tableRows = table.getRowModel().rows

  // The React Compiler is not used here, so its warning about memoizing this hook does not apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  })
  const virtualRows = virtualizer.getVirtualItems()
  const lastVisible = virtualRows.at(-1)?.index ?? -1

  const nearEnd = lastVisible >= tableRows.length - prefetchRows
  useEffect(() => {
    if (nearEnd && hasMore && !isLoadingMore && !moreFailed) loadMore()
    // `loadMore` is a new function every render; the conditions above are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearEnd, hasMore, isLoadingMore, moreFailed])

  // Another list in the same table (a new search, a filter, Back): start from its top, not at the old scroll depth.
  // Loading more pages keeps the list's identity, so scrolling down never triggers this.
  const { listIdentity } = source
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [listIdentity])

  if (source.loadError !== null) {
    return (
      <ProblemAlert
        title={t.dataTable.firstPageFailed}
        error={source.loadError}
        onRetry={source.retryLoad}
        className={className}
      />
    )
  }
  if (!source.isPending && rows.length === 0) return <>{empty}</>

  const headers = table.getHeaderGroups()[0]?.headers ?? []
  const paddingTop = virtualRows[0]?.start ?? 0
  const paddingBottom =
    virtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0)

  return (
    <div
      ref={scrollRef}
      className={cn("min-h-0 overflow-auto rounded-lg border", className)}
      // Keyboard users scroll the list with the arrow keys once it has focus (WCAG: a scrolling region is focusable).
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <table
        className="w-full table-fixed caption-bottom text-sm"
        style={{ minWidth: table.getTotalSize() }}
        aria-rowcount={hasMore ? -1 : tableRows.length + 1}
      >
        <colgroup>
          {headers.map((header) => (
            <col
              key={header.id}
              style={{
                width: header.column.columnDef.meta?.grow
                  ? undefined
                  : header.getSize(),
              }}
            />
          ))}
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow aria-rowindex={1}>
            {headers.map((header) => (
              <DataTableHead key={header.id} header={header} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {source.isPending &&
            Array.from({ length: skeletonRows }, (_, index) => (
              <TableRow key={index} style={{ height: rowHeight }}>
                {headers.map((header) => (
                  <TableCell key={header.id} className="py-0">
                    <Skeleton className="h-4 w-3/4" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {paddingTop > 0 && <SpacerRow height={paddingTop} />}
          {virtualRows.map((virtualRow) => {
            const row = tableRows[virtualRow.index]
            if (!row) return null
            return (
              <TableRow
                key={row.id}
                style={{ height: rowHeight }}
                aria-rowindex={virtualRow.index + 2}
              >
                {row.getAllCells().map((cell) => (
                  <DataTableCell key={cell.id} cell={cell} />
                ))}
              </TableRow>
            )
          })}
          {paddingBottom > 0 && <SpacerRow height={paddingBottom} />}
        </TableBody>
      </table>
      {isLoadingMore && (
        <div
          className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground"
          role="status"
        >
          <Spinner aria-hidden />
          {t.dataTable.loadingMore}
        </div>
      )}
      {moreFailed && (
        <ProblemAlert
          title={t.dataTable.nextPageFailed}
          error={moreError}
          onRetry={loadMore}
          className="sticky left-0 m-2 w-auto"
        />
      )}
    </div>
  )
}

function SpacerRow({ height }: { height: number }) {
  return <tr aria-hidden style={{ height }} />
}

function DataTableHead<T extends RowData>({
  header,
}: {
  header: Header<typeof dataTableFeatures, T>
}) {
  const align = header.column.columnDef.meta?.align
  return (
    <TableHead className={cn(align === "end" && "text-right")}>
      {header.isPlaceholder
        ? null
        : flexRender(header.column.columnDef.header, header.getContext())}
    </TableHead>
  )
}

function DataTableCell<T extends RowData>({
  cell,
}: {
  cell: Cell<typeof dataTableFeatures, T>
}) {
  const align = cell.column.columnDef.meta?.align
  return (
    <TableCell
      className={cn(
        "truncate py-0",
        align === "end" && "text-right tabular-nums"
      )}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  )
}
