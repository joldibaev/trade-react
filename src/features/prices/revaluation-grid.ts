import type { FieldCode } from "@/api/errors"
import { isZeroDecimal, parseDecimalInput } from "@/lib/decimal"

import type {
  PriceType,
  Revaluation,
  RevaluationLineRequest,
} from "./prices-api"

/**
 * The revaluation screen shows one row per product and a "was | becomes" pair per price type, as trade4 did; the
 * API keeps flat lines (product, type, new price). This module turns one into the other.
 *
 * A cell is one of three things, and the difference matters to the server (TradeNet prices.md):
 * - untouched (empty, not removed): no line at all, the price stays as it is;
 * - a new price: a line with `newPrice`;
 * - removed: a line with `newPrice: null`, which deletes the price. Never sent by leaving a field empty.
 */
export type GridCell = { priceTypeId: string; price: string; remove: boolean }

export type GridRow = {
  /** The product's id again: DataTable keys its rows by `id`. */
  id: string
  productId: string
  code: number
  name: string
  /** One cell per column type, in the order of `columnTypes`. */
  cells: GridCell[]
}

export const priceKey = (productId: string, priceTypeId: string) =>
  `${productId}|${priceTypeId}`

/** Money has 2 fraction digits (`[Money]`, docs/platform/json-and-numbers.md). */
export const priceScale = 2

/**
 * The type columns of the grid: every active type, and inactive ones the document already uses (so a line is never
 * hidden). The default first, then by name.
 */
export function columnTypes(
  types: readonly PriceType[],
  lines: Revaluation["lines"] = []
): PriceType[] {
  const used = new Set(lines.map((line) => line.priceTypeId))
  return types
    .filter((type) => type.isActive || used.has(type.id))
    .sort(
      (a, b) =>
        (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) ||
        a.name.localeCompare(b.name, "ru")
    )
}

export function emptyRow(
  product: { id: string; code: number; name: string },
  types: readonly PriceType[]
): GridRow {
  return {
    id: product.id,
    productId: product.id,
    code: product.code,
    name: product.name,
    cells: types.map((type) => ({
      priceTypeId: type.id,
      price: "",
      remove: false,
    })),
  }
}

/** The saved lines as grid rows, products in the order their first line came. */
export function rowsFromLines(
  lines: Revaluation["lines"],
  types: readonly PriceType[]
): GridRow[] {
  const rows = new Map<string, GridRow>()
  for (const line of lines) {
    let row = rows.get(line.productId)
    if (!row) {
      row = emptyRow(
        { id: line.productId, code: line.productCode, name: line.productName },
        types
      )
      rows.set(line.productId, row)
    }
    const cell = row.cells.find((c) => c.priceTypeId === line.priceTypeId)
    if (!cell) continue
    if (line.newPrice === null) cell.remove = true
    else cell.price = line.newPrice.replace(".", ",")
  }
  return [...rows.values()]
}

export const cellField = (
  row: number,
  cell: number
): `rows[${number}].cells[${number}].price` =>
  `rows[${row}].cells[${cell}].price`

/** The cells a person cannot save: not a number, more than 2 fraction digits, or zero (prices are above zero). */
export function invalidCells(
  rows: readonly GridRow[]
): Record<string, FieldCode> {
  const fields: Record<string, FieldCode> = {}
  rows.forEach((row, r) => {
    row.cells.forEach((cell, c) => {
      if (cell.remove || cell.price.trim() === "") return
      const value = parseDecimalInput(cell.price, priceScale)
      if (value === null) fields[cellField(r, c)] = "INVALID_VALUE"
      else if (isZeroDecimal(value)) fields[cellField(r, c)] = "OUT_OF_RANGE"
    })
  })
  return fields
}

/**
 * The lines to send, and for each line the grid field it came from: the server names a bad line `lines[3]`, which
 * the form must show under the right cell.
 */
export function linesFromRows(rows: readonly GridRow[]): {
  lines: RevaluationLineRequest[]
  fieldOfLine: string[]
} {
  const lines: RevaluationLineRequest[] = []
  const fieldOfLine: string[] = []
  rows.forEach((row, r) => {
    row.cells.forEach((cell, c) => {
      const price = cell.price.trim()
      if (!cell.remove && price === "") return
      lines.push({
        productId: row.productId,
        priceTypeId: cell.priceTypeId,
        newPrice: cell.remove
          ? null
          : (parseDecimalInput(price, priceScale) ?? price),
      })
      fieldOfLine.push(cellField(r, c))
    })
  })
  return { lines, fieldOfLine }
}

/** `lines[3].newPrice` → the cell's field name; anything else stays as it is. */
export function serverFieldName(key: string, fieldOfLine: readonly string[]) {
  const index = /^lines\[(\d+)\]/i.exec(key)?.[1]
  if (index === undefined) return key
  return fieldOfLine.find((_, i) => String(i) === index) ?? key
}
