import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { wholeListOptions } from "@/api/cursor-pages"
import { readAgainOnConflict } from "@/api/writes"
import type { components } from "@/api/schema"

export type Store = components["schemas"]["StoreResponse"]
export type Cashbox = components["schemas"]["CashboxResponse"]
export type StoreChanges = Omit<
  components["schemas"]["UpdateStoreRequest"],
  "version"
>
export type CashboxChanges = Omit<
  components["schemas"]["UpdateCashboxRequest"],
  "version"
>

/**
 * Stores are a short list the API answers whole, already limited to the person's own stores (TradeNet stores.md):
 * a manager of Юнусабад gets only Юнусабад, and another store's page answers 404 as if it did not exist.
 */
export function storesQuery(filters: { isActive?: boolean | undefined } = {}) {
  return wholeListOptions(["stores", "list", filters], () =>
    unwrap(api.GET("/api/stores", { params: { query: filters } }))
  )
}

export function storeQuery(id: string) {
  return queryOptions({
    queryKey: ["stores", "one", id],
    queryFn: () =>
      unwrap(api.GET("/api/stores/{id}", { params: { path: { id } } })),
  })
}

/** After any write: the store's page and every list (the cashboxes are part of the store's answer). */
function remember(queryClient: QueryClient, store: Store) {
  queryClient.setQueryData(storeQuery(store.id).queryKey, store)
  void queryClient.invalidateQueries({ queryKey: ["stores", "list"] })
}

export async function createStore(
  queryClient: QueryClient,
  body: components["schemas"]["CreateStoreRequest"]
) {
  const store = await unwrap(api.POST("/api/stores", { body }))
  remember(queryClient, store)
  return store
}

export async function updateStore(
  queryClient: QueryClient,
  store: Pick<Store, "id" | "version">,
  changes: StoreChanges
) {
  const updated = await readAgainOnConflict(
    queryClient,
    ["stores"],
    unwrap(
      api.PATCH("/api/stores/{id}", {
        params: { path: { id: store.id } },
        body: { version: store.version, ...changes },
      })
    )
  )
  remember(queryClient, updated)
  return updated
}

/** The store's answer lists its cashboxes, so after a cashbox write the stores are read again. */
async function refreshStores(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ["stores"] })
}

export async function createCashbox(
  queryClient: QueryClient,
  storeId: string,
  body: components["schemas"]["CreateCashboxRequest"]
) {
  const cashbox = await unwrap(
    api.POST("/api/stores/{storeId}/cashboxes", {
      params: { path: { storeId } },
      body,
    })
  )
  await refreshStores(queryClient)
  return cashbox
}

export async function updateCashbox(
  queryClient: QueryClient,
  cashbox: Pick<Cashbox, "id" | "version" | "storeId">,
  changes: CashboxChanges
) {
  const updated = await readAgainOnConflict(
    queryClient,
    ["stores"],
    unwrap(
      api.PATCH("/api/cashboxes/{id}", {
        params: { path: { id: cashbox.id } },
        body: { version: cashbox.version, ...changes },
      })
    )
  )
  await refreshStores(queryClient)
  return updated
}
