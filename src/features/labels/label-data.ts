import type { Product } from "@/features/products/products-query"
import type { PriceType } from "@/features/prices/prices-api"
import { formatDecimal } from "@/lib/decimal"
import { formatInstant } from "@/lib/instant"

import type { LabelLayout } from "./templates-api"

/** What a text element may say in braces (TradeNet `LabelLimits.Variables`). */
export const labelVariables = [
  "name",
  "code",
  "barcode",
  "price",
  "priceType",
  "category",
  "date",
] as const

export type LabelVariable = (typeof labelVariables)[number]

/** One label's data: the variables' text, the prices it may show, the barcode, the currency word. */
export type LabelData = {
  values: Record<LabelVariable, string>
  /** The price of a type as the API writes it ("12500.00"); null: the type chosen at printing. Null when there is none. */
  price: (priceTypeId: string | null) => string | null
  barcode: string | null
  currency: string
}

/** A price as a label writes it: whole sums without ",00" ("12 500"), anything else exactly ("12 500,50"). */
export function labelPrice(price: string): string {
  return formatDecimal(price.replace(/\.00$/, ""))
}

/** "Кетчуп {name}" → with the product's data; an unknown brace stays as typed (the editor refuses it before saving). */
export function fillVariables(
  text: string,
  values: Record<LabelVariable, string>
): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    (labelVariables as readonly string[]).includes(name)
      ? values[name as LabelVariable]
      : whole
  )
}

/** The braces a text uses that are not variables: `{article}` is no longer one. */
export function unknownVariables(text: string): string[] {
  return [...text.matchAll(/\{(\w*)\}/g)]
    .map((m) => m[1] ?? "")
    .filter((name) => !(labelVariables as readonly string[]).includes(name))
}

/** Today in Tashkent, as a label prints it: "28.10.2026". */
export function today(): string {
  return formatInstant(new Date().toISOString()).slice(0, 10)
}

/** The data of a product's label, with the price type chosen at printing and the barcode chosen for the line. */
export function labelDataOf(
  product: Pick<Product, "name" | "code" | "prices">,
  options: {
    priceTypeId: string | null
    priceTypes: readonly PriceType[]
    category: string
    barcode: string | null
    currency: string
  }
): LabelData {
  const priceOf = (id: string | null) =>
    product.prices.find((p) => p.priceTypeId === (id ?? options.priceTypeId))
      ?.price ?? null
  const chosen = priceOf(null)
  return {
    values: {
      name: product.name,
      code: String(product.code),
      barcode: options.barcode ?? "",
      price: chosen === null ? "" : labelPrice(chosen),
      priceType:
        options.priceTypes.find((t) => t.id === options.priceTypeId)?.name ??
        "",
      category: options.category,
      date: today(),
    },
    price: priceOf,
    barcode: options.barcode,
    currency: options.currency,
  }
}

/** What a template needs from a product to print: the chosen price, fixed price types, a barcode. */
export function templateNeeds(layout: LabelLayout) {
  const fixed = new Set<string>()
  let chosenPrice = false
  let barcode = false
  for (const element of layout.elements) {
    if (element.type === "PRICE") {
      if (element.priceTypeId) fixed.add(element.priceTypeId)
      else chosenPrice = true
    }
    if (element.type === "TEXT") {
      if (/\{price(Type)?\}/.test(element.text)) chosenPrice = true
      if (element.text.includes("{barcode}")) barcode = true
    }
    if (element.type === "BARCODE") barcode = true
  }
  return { chosenPrice, fixedPriceTypes: [...fixed], barcode }
}
