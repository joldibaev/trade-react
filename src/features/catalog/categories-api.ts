import type { QueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { wholeListOptions } from "@/api/cursor-pages"
import type { components } from "@/api/schema"
import { readAgainOnConflict } from "@/api/writes"

import type { Category } from "./category-tree"

/** Every category of the chain, one flat list; read by everyone signed in. */
export const categoriesQuery = wholeListOptions(["categories"], () =>
  unwrap(api.GET("/api/categories"))
)

async function refresh(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ["categories"] })
}

export async function createCategory(
  queryClient: QueryClient,
  body: components["schemas"]["CreateCategoryRequest"]
) {
  const category = await unwrap(api.POST("/api/categories", { body }))
  await refresh(queryClient)
  return category
}

/** Renames, or moves with `parent: {id}` (`{id: null}`: to the top). */
export async function updateCategory(
  queryClient: QueryClient,
  category: Pick<Category, "id" | "version">,
  changes: Omit<components["schemas"]["UpdateCategoryRequest"], "version">
) {
  const updated = await readAgainOnConflict(
    queryClient,
    ["categories"],
    unwrap(
      api.PATCH("/api/categories/{id}", {
        params: { path: { id: category.id } },
        body: { version: category.version, ...changes },
      })
    )
  )
  await refresh(queryClient)
  return updated
}

/** Only an empty category is deleted (409 `CATEGORY_NOT_EMPTY` otherwise): no subcategories, no products. */
export async function deleteCategory(
  queryClient: QueryClient,
  category: Pick<Category, "id" | "version">
) {
  await readAgainOnConflict(
    queryClient,
    ["categories"],
    unwrap(
      api.DELETE("/api/categories/{id}", {
        params: {
          path: { id: category.id },
          query: { version: category.version },
        },
      })
    )
  )
  await refresh(queryClient)
}
