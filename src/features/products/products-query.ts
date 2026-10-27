import { queryOptions } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { cursorListOptions } from "@/api/cursor-pages"
import type { components } from "@/api/schema"
import { isActiveFilter, type ActiveStatus } from "@/components/page"

export type ProductListItem = components["schemas"]["ProductListItem"]
export type Product = components["schemas"]["ProductResponse"]

/** The product list's filters, as the URL keeps them (`/products?categoryId=...&status=active`). */
export type ProductFilters = {
  search?: string
  /** This category and all its subcategories, at any depth. */
  categoryId?: string
  /** The products with no category: imported ones waiting to be sorted. */
  withoutCategory?: true
  status?: ActiveStatus
}

const pageSize = 100

/**
 * Without a search: the products by name, page after page. With one: TradeNet answers its best matches in one
 * page (no cursor), so the list simply ends there.
 */
export function productsListOptions({ status, ...filters }: ProductFilters) {
  return cursorListOptions(["products", "list", filters, status], (cursor) =>
    unwrap(
      api.GET("/api/products", {
        params: {
          query: {
            ...filters,
            isActive: isActiveFilter(status),
            cursor,
            limit: pageSize,
          },
        },
      })
    )
  )
}

export function productQuery(id: string) {
  return queryOptions({
    queryKey: ["products", "one", id],
    queryFn: () =>
      unwrap(api.GET("/api/products/{id}", { params: { path: { id } } })),
  })
}
