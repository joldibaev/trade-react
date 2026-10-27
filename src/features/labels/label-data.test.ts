import { describe, expect, it } from "vitest"

import {
  fillVariables,
  labelDataOf,
  labelPrice,
  templateNeeds,
  unknownVariables,
} from "./label-data"
import type { LabelLayout } from "./templates-api"

const retail = {
  id: "r",
  name: "Розница",
  isActive: true,
  isDefault: true,
  version: 1,
}
const wholesale = {
  id: "w",
  name: "Опт",
  isActive: true,
  isDefault: false,
  version: 1,
}
const product = {
  name: "Кетчуп",
  code: 12320,
  prices: [
    { priceTypeId: "r", price: "18790.00" },
    { priceTypeId: "w", price: "15000.50" },
  ],
}

describe("label price", () => {
  it("drops the zero kopecks of a whole sum and keeps any other", () => {
    expect(labelPrice("12500.00")).toBe("12 500")
    expect(labelPrice("12500.50")).toBe("12 500,50")
  })
})

describe("variables", () => {
  const values = {
    name: "Кетчуп",
    code: "12320",
    barcode: "2013175842038",
    price: "18 790",
    priceType: "Розница",
    category: "Соусы",
    date: "28.10.2026",
  }

  it("fills the known braces and leaves an unknown one as typed", () => {
    expect(fillVariables("{name}, код {code}", values)).toBe(
      "Кетчуп, код 12320"
    )
    expect(fillVariables("{article}", values)).toBe("{article}")
  })

  it("names the braces that are not variables", () => {
    expect(unknownVariables("{name} {article} {}")).toEqual(["article", ""])
    expect(unknownVariables("{price} {priceType}")).toEqual([])
  })
})

describe("a product's label data", () => {
  const data = labelDataOf(product, {
    priceTypeId: "r",
    priceTypes: [retail, wholesale],
    category: "Соусы",
    barcode: "2013175842038",
    currency: "сум",
  })

  it("takes the chosen type's price for {price} and a null price type", () => {
    expect(data.values.price).toBe("18 790")
    expect(data.values.priceType).toBe("Розница")
    expect(data.price(null)).toBe("18790.00")
  })

  it("gives a fixed type's price, and null for a type the product has no price of", () => {
    expect(data.price("w")).toBe("15000.50")
    expect(data.price("other")).toBeNull()
  })
})

describe("what a template needs", () => {
  const box = { xMm: "0.00", yMm: "0.00", widthMm: "10.00", heightMm: "5.00" }
  const style = {
    font: "SANS",
    fontSizePt: 9,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    align: "START",
    verticalAlign: "TOP",
    fit: true,
    inverted: false,
  } as const

  it("collects the chosen price, the fixed types and the barcode from every kind", () => {
    const layout: LabelLayout = {
      widthMm: "58.00",
      heightMm: "40.00",
      elements: [
        {
          type: "PRICE",
          priceTypeId: "w",
          split: false,
          currency: true,
          style,
          ...box,
        },
        { type: "TEXT", text: "Код {code}", style, ...box },
        { type: "TEXT", text: "{barcode}", style, ...box },
      ],
    }
    expect(templateNeeds(layout)).toEqual({
      chosenPrice: false,
      fixedPriceTypes: ["w"],
      barcode: true,
    })
  })

  it("needs the chosen price for a price element without a type and for {price} in a text", () => {
    const of = (elements: LabelLayout["elements"]) =>
      templateNeeds({ widthMm: "58.00", heightMm: "40.00", elements })
    expect(
      of([
        {
          type: "PRICE",
          priceTypeId: null,
          split: true,
          currency: true,
          style,
          ...box,
        },
      ]).chosenPrice
    ).toBe(true)
    expect(
      of([{ type: "TEXT", text: "{priceType}", style, ...box }]).chosenPrice
    ).toBe(true)
    expect(of([{ type: "BARCODE", digits: true, ...box }])).toEqual({
      chosenPrice: false,
      fixedPriceTypes: [],
      barcode: true,
    })
  })
})
