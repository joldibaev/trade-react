import { describe, expect, it } from "vitest"

import type { PriceType, Revaluation } from "./prices-api"
import {
  columnTypes,
  invalidCells,
  linesFromRows,
  rowsFromLines,
  serverFieldName,
} from "./revaluation-grid"

const type = (
  id: string,
  name: string,
  extra: Partial<PriceType> = {}
): PriceType => ({
  id,
  name,
  isActive: true,
  isDefault: false,
  version: 1,
  ...extra,
})
const retail = type("retail", "Розница", { isDefault: true })
const wholesale = type("wholesale", "Опт")
const old = type("old", "Старая", { isActive: false })

const line = (
  productId: string,
  priceTypeId: string,
  newPrice: string | null
): Revaluation["lines"][number] => ({
  productId,
  productCode: productId === "a" ? 10000 : 10001,
  productName: productId === "a" ? "Тетрадь" : "Ручка",
  priceTypeId,
  oldPrice: null,
  newPrice,
})

describe("revaluation grid", () => {
  it("shows active types, the default first, and inactive ones only when the document uses them", () => {
    expect(columnTypes([wholesale, old, retail]).map((t) => t.id)).toEqual([
      "retail",
      "wholesale",
    ])
    expect(
      columnTypes([wholesale, old, retail], [line("a", "old", "1.00")]).map(
        (t) => t.id
      )
    ).toEqual(["retail", "wholesale", "old"])
  })

  it("turns flat lines into one row per product and back, keeping removals", () => {
    const types = [retail, wholesale]
    const rows = rowsFromLines(
      [
        line("a", "retail", "12500.00"),
        line("b", "wholesale", null),
        line("a", "wholesale", "11000.50"),
      ],
      types
    )
    expect(rows.map((r) => r.name)).toEqual(["Тетрадь", "Ручка"])
    expect(rows[0]?.cells.map((c) => c.price)).toEqual(["12500,00", "11000,50"])
    expect(rows[1]?.cells.map((c) => c.remove)).toEqual([false, true])

    const { lines, fieldOfLine } = linesFromRows(rows)
    expect(lines).toEqual([
      { productId: "a", priceTypeId: "retail", newPrice: "12500.00" },
      { productId: "a", priceTypeId: "wholesale", newPrice: "11000.50" },
      { productId: "b", priceTypeId: "wholesale", newPrice: null },
    ])
    expect(fieldOfLine).toEqual([
      "rows[0].cells[0].price",
      "rows[0].cells[1].price",
      "rows[1].cells[1].price",
    ])
  })

  it("sends nothing for an untouched cell: an empty field never removes a price", () => {
    const rows = rowsFromLines(
      [line("a", "retail", "1.00")],
      [retail, wholesale]
    )
    const { lines } = linesFromRows(rows)
    expect(lines).toHaveLength(1)
  })

  it("refuses a price that is not a number, too precise, or zero", () => {
    const rows = rowsFromLines(
      [line("a", "retail", "1.00")],
      [retail, wholesale]
    )
    const row = rows[0]
    if (!row?.cells[0] || !row.cells[1]) throw new Error("no cells")
    row.cells[0].price = "12,345"
    row.cells[1].price = "0"
    expect(invalidCells(rows)).toEqual({
      "rows[0].cells[0].price": "INVALID_VALUE",
      "rows[0].cells[1].price": "OUT_OF_RANGE",
    })
  })

  it("names the cell of a line the server refused", () => {
    const fields = ["rows[0].cells[0].price", "rows[1].cells[1].price"]
    expect(serverFieldName("lines[1].newPrice", fields)).toBe(
      "rows[1].cells[1].price"
    )
    expect(serverFieldName("lines[1]", fields)).toBe("rows[1].cells[1].price")
    expect(serverFieldName("comment", fields)).toBe("comment")
  })
})
