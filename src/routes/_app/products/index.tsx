import { createFileRoute } from "@tanstack/react-router"

import { parseActiveStatus } from "@/components/page"
import { ProductsPage } from "@/features/products/products-page"
import type { ProductFilters } from "@/features/products/products-query"

const text = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined

export const Route = createFileRoute("/_app/products/")({
  validateSearch: (search: Record<string, unknown>): ProductFilters => {
    const filters: ProductFilters = {}
    const searchText = text(search.search)
    if (searchText) filters.search = searchText
    const categoryId = text(search.categoryId)
    // One category or "without category", never both: the API would answer an empty list.
    if (categoryId) filters.categoryId = categoryId
    else if (search.withoutCategory === true) filters.withoutCategory = true
    const status = parseActiveStatus(search.status)
    if (status) filters.status = status
    return filters
  },
  component: function Products() {
    return <ProductsPage filters={Route.useSearch()} />
  },
})
