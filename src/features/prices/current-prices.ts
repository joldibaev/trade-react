import { useQueries } from "@tanstack/react-query"
import { useMemo } from "react"

import { pricesQuery } from "./prices-api"

/** The API reads current prices for at most 100 products at once. */
const chunk = 100

export const priceKey = (productId: string, priceTypeId: string) =>
  `${productId}|${priceTypeId}`

/**
 * Current prices of any number of products, read 100 at a time, as `priceKey(product, type)` → price. A product
 * without a price of a type has no entry.
 */
export function useCurrentPrices(productIds: readonly string[]) {
  const chunks = useMemo(() => {
    const ids = [...new Set(productIds)].sort()
    const result: string[][] = []
    for (let i = 0; i < ids.length; i += chunk)
      result.push(ids.slice(i, i + chunk))
    return result
  }, [productIds])

  return useQueries({
    queries: chunks.map((ids) => pricesQuery(ids)),
    combine: (results) => {
      const prices = new Map<string, string>()
      for (const result of results)
        for (const price of result.data ?? [])
          prices.set(priceKey(price.productId, price.priceTypeId), price.price)
      return {
        prices,
        isPending: results.some((r) => r.isPending),
        error: results.find((r) => r.isError)?.error ?? null,
      }
    },
  })
}
