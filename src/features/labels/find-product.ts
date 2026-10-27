import type { QueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { productQuery, type Product } from "@/features/products/products-query"

/** A product found by what was scanned or typed, with the barcode that was scanned (null: take the primary). */
export type Found = { product: Product; barcode: string | null }

/**
 * What a scanner or a typed code names. TradeNet's search puts an exact code or barcode first, so the first match is
 * checked against the product card's every barcode (a box's barcode, not only the primary). Null when the text names
 * no product exactly: the screen then offers the search results to choose from.
 */
export async function findExact(
  queryClient: QueryClient,
  text: string
): Promise<Found | null> {
  const page = await unwrap(
    api.GET("/api/products", { params: { query: { search: text, limit: 5 } } })
  )
  const first = page.items[0]
  if (!first) return null
  const byCode = String(first.code) === text
  if (!byCode && !/^\d+$/.test(text) && first.barcode !== text) return null
  const product = await queryClient.query({
    ...productQuery(first.id),
    staleTime: 0,
  })
  if (product.barcodes.some((b) => b.value === text))
    return { product, barcode: text }
  return byCode ? { product, barcode: null } : null
}
