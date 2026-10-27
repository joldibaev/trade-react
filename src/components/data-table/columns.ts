import {
  columnSizingFeature,
  createColumnHelper,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table"

export type DataTableColumnMeta = {
  /** The column takes the width left over by the others (a name, a description). */
  grow?: boolean
  /** Numbers, money and codes line up on the right. */
  align?: "end"
}

// A type-only slot: it tells TanStack Table what `columnDef.meta` holds.
const columnMeta: DataTableColumnMeta = {}

// Module scope on purpose: a new features object on every render would rebuild the table models.
export const dataTableFeatures = tableFeatures({
  columnSizingFeature,
  columnMeta,
})

// Each column has its own value type; the list holds them all, as `helper.columns([...])` returns it.
/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the value type differs per column */
type AnyValue = any
export type DataTableColumns<T extends RowData> = ColumnDef<
  typeof dataTableFeatures,
  T,
  AnyValue
>[]

/** The column helper for DataTable rows of type `T`. Define columns at module scope or in `useMemo`. */
export function dataTableColumns<T extends RowData>() {
  return createColumnHelper<typeof dataTableFeatures, T>()
}
