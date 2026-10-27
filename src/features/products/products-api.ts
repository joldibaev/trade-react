import type { QueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import type { components } from "@/api/schema"
import { readAgainOnConflict } from "@/api/writes"

import { productQuery, type Product } from "./products-query"

/** After a write: the product's page from the answer, the lists read again (the name or category may move a row). */
function remember(queryClient: QueryClient, product: Product) {
  queryClient.setQueryData(productQuery(product.id).queryKey, product)
  void queryClient.invalidateQueries({ queryKey: ["products", "list"] })
}

/** A repeated create may add a second product with the same name (TradeNet marks it repeat-safe for that reason). */
export async function createProduct(
  queryClient: QueryClient,
  body: components["schemas"]["CreateProductRequest"]
) {
  const product = await unwrap(api.POST("/api/products", { body }))
  remember(queryClient, product)
  return product
}

export async function updateProduct(
  queryClient: QueryClient,
  product: Pick<Product, "id" | "version">,
  changes: Omit<components["schemas"]["UpdateProductRequest"], "version">
) {
  const updated = await readAgainOnConflict(
    queryClient,
    ["products"],
    unwrap(
      api.PATCH("/api/products/{id}", {
        params: { path: { id: product.id } },
        body: { version: product.version, ...changes },
      })
    )
  )
  remember(queryClient, updated)
  return updated
}

/**
 * A fresh in-store EAN-13 from TradeNet ("2" + 11 digits + check digit, as iBox makes them). The number is not
 * reserved: it goes into the form's barcode list and is saved with the product as usual (which may still answer 409
 * BARCODE_TAKEN); an abandoned form leaves an unused number.
 */
export async function generateBarcode() {
  const generated = await unwrap(api.POST("/api/products/barcodes/generate"))
  return generated.value
}
