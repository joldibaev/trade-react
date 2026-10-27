import type { QueryClient } from "@tanstack/react-query"

import { isApiError } from "@/api/errors"
import { categoriesQuery } from "@/features/catalog/categories-api"
import { categoryPath } from "@/features/catalog/category-tree"
import { priceTypesQuery, type PriceType } from "@/features/prices/prices-api"
import { productQuery, type Product } from "@/features/products/products-query"

import { labelDataOf, templateNeeds, type LabelData } from "./label-data"
import { templateQuery, type LabelLayout } from "./templates-api"

/** One row of a print job: a product, the barcode to print (one of its own), and how many labels. */
export type LabelLine = {
  product: Product
  barcode: string | null
  copies: number
}

/** The browser's print dialog and the printer's queue slow down past this; trade4 used the same limit. */
export const maxLabelsPerJob = 1000

/** What a job prints with: the template, the price type chosen for the job, the currency word of the screen. */
export type JobSettings = {
  templateId: string
  priceTypeId: string
  currency: string
}

/** Why a job did not print, naming the line (1-based, as the screen numbers them) when one line is the cause. */
export type JobRefusal =
  | { reason: "tooMany"; total: number }
  | { reason: "empty" }
  | { reason: "templateGone" }
  | {
      reason: "noPrice" | "noBarcode" | "productGone"
      line: number
      name: string
      /** The price type missing (the chosen one, or one the template fixes). */
      priceType?: string
    }

/** Product data for labels: the price types (their names) and the category (its path). */
export function labelDataFor(
  product: Product,
  settings: Omit<JobSettings, "templateId">,
  barcode: string | null,
  priceTypes: readonly PriceType[],
  categories: Parameters<typeof categoryPath>[1]
): LabelData {
  return labelDataOf(product, {
    priceTypeId: settings.priceTypeId,
    priceTypes,
    category:
      product.categoryId === null
        ? ""
        : categoryPath(product.categoryId, categories),
    barcode,
    currency: settings.currency,
  })
}

/**
 * The template and labels to print, read again just now: a page open since the morning must not print yesterday's
 * price or an old template. A line whose product is gone, lacks a price the template shows, or no longer has the
 * chosen barcode the template needs stops the whole job; the list stays on screen to correct and retry.
 */
export async function prepareLabels(
  queryClient: QueryClient,
  lines: readonly LabelLine[],
  settings: JobSettings
): Promise<
  { layout: LabelLayout; labels: LabelData[] } | { refusal: JobRefusal }
> {
  const total = lines.reduce((sum, line) => sum + line.copies, 0)
  if (total === 0) return { refusal: { reason: "empty" } }
  if (total > maxLabelsPerJob) return { refusal: { reason: "tooMany", total } }

  let template
  try {
    template = await queryClient.query({
      ...templateQuery(settings.templateId),
      staleTime: 0,
    })
  } catch (error) {
    if (isApiError(error) && error.code === "LABEL_TEMPLATE_NOT_FOUND")
      return { refusal: { reason: "templateGone" } }
    throw error
  }
  if (!template.isActive) return { refusal: { reason: "templateGone" } }

  const [priceTypes, categoryList] = await Promise.all([
    queryClient.query(priceTypesQuery),
    queryClient.query(categoriesQuery),
  ])
  const categories = new Map(categoryList.map((c) => [c.id, c]))
  const fresh = new Map<string, Product | null>()
  await Promise.all(
    [...new Set(lines.map((line) => line.product.id))].map(async (id) => {
      try {
        fresh.set(
          id,
          await queryClient.query({ ...productQuery(id), staleTime: 0 })
        )
      } catch (error) {
        if (isApiError(error) && error.code === "PRODUCT_NOT_FOUND")
          fresh.set(id, null)
        else throw error
      }
    })
  )

  const needs = templateNeeds(template.layout)
  const typeName = (id: string) =>
    priceTypes.find((type) => type.id === id)?.name ?? ""
  const labels: LabelData[] = []
  for (const [index, line] of lines.entries()) {
    const named = { line: index + 1, name: line.product.name }
    const product = fresh.get(line.product.id)
    if (!product) return { refusal: { reason: "productGone", ...named } }
    const has = (id: string) => product.prices.some((p) => p.priceTypeId === id)
    if (needs.chosenPrice && !has(settings.priceTypeId))
      return {
        refusal: {
          reason: "noPrice",
          ...named,
          priceType: typeName(settings.priceTypeId),
        },
      }
    const missing = needs.fixedPriceTypes.find((id) => !has(id))
    if (missing !== undefined)
      return {
        refusal: { reason: "noPrice", ...named, priceType: typeName(missing) },
      }
    const barcode =
      line.barcode !== null &&
      product.barcodes.some((b) => b.value === line.barcode)
        ? line.barcode
        : null
    if (needs.barcode && barcode === null)
      return { refusal: { reason: "noBarcode", ...named } }
    const data = labelDataFor(
      product,
      settings,
      barcode,
      priceTypes,
      categories
    )
    for (let copy = 0; copy < line.copies; copy++) labels.push(data)
  }
  return { layout: template.layout, labels }
}
