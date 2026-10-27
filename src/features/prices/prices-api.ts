import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { cursorListOptions, wholeListOptions } from "@/api/cursor-pages"
import { problemWith } from "@/api/errors"
import type { components } from "@/api/schema"
import { readAgainOnConflict } from "@/api/writes"
import { nextDay, tashkentDayStart } from "@/lib/instant"

export type PriceType = components["schemas"]["PriceTypeResponse"]
export type Revaluation = components["schemas"]["RevaluationResponse"]
export type RevaluationListItem = components["schemas"]["RevaluationListItem"]
export type RevaluationStatus = components["schemas"]["RevaluationStatus"]
export type RevaluationLineRequest =
  components["schemas"]["RevaluationLineRequest"]
export type PriceHistoryItem = components["schemas"]["PriceHistoryItem"]
export type ProductPrice = components["schemas"]["ProductPrice"]

// ---- Price types: a short list, read by everyone (cashiers need prices), managed with PRICES_MANAGE.

export const priceTypesQuery = wholeListOptions(["price-types"], () =>
  unwrap(api.GET("/api/price-types"))
)

export async function createPriceType(queryClient: QueryClient, name: string) {
  const created = await unwrap(api.POST("/api/price-types", { body: { name } }))
  await queryClient.invalidateQueries({ queryKey: ["price-types"] })
  return created
}

/** Renames, deactivates, or makes the default (the one every receipt starts with; the old default stops being it). */
export async function updatePriceType(
  queryClient: QueryClient,
  priceType: Pick<PriceType, "id" | "version">,
  changes: Omit<components["schemas"]["UpdatePriceTypeRequest"], "version">
) {
  const updated = await readAgainOnConflict(
    queryClient,
    ["price-types"],
    unwrap(
      api.PATCH("/api/price-types/{id}", {
        params: { path: { id: priceType.id } },
        body: { version: priceType.version, ...changes },
      })
    )
  )
  // Making one type the default changes another one too: read them all again.
  await queryClient.invalidateQueries({ queryKey: ["price-types"] })
  return updated
}

/**
 * Only a type nothing refers to is deleted: not the default, no prices or price history, in no revaluation (drafts
 * included), fixed by no label template (409 `PRICE_TYPE_*` otherwise). A used type is deactivated instead.
 */
export async function deletePriceType(
  queryClient: QueryClient,
  priceType: Pick<PriceType, "id" | "version">
) {
  await readAgainOnConflict(
    queryClient,
    ["price-types"],
    unwrap(
      api.DELETE("/api/price-types/{id}", {
        params: {
          path: { id: priceType.id },
          query: { version: priceType.version },
        },
      })
    )
  )
  await queryClient.invalidateQueries({ queryKey: ["price-types"] })
}

// ---- Price history. The current prices travel with the product (`ProductResponse.prices`, list items too).

export function priceHistoryOptions(productId: string) {
  return cursorListOptions(["prices", "history", productId], (cursor) =>
    unwrap(
      api.GET("/api/products/{productId}/price-history", {
        params: { path: { productId }, query: { cursor, limit: 100 } },
      })
    )
  )
}

// ---- Revaluations: the only way a price changes.

/** The revaluations list's filters, as the URL keeps them; the period is in Tashkent days, both ends included. */
export type RevaluationFilters = {
  status?: RevaluationStatus
  from?: string
  to?: string
}

export function revaluationsListOptions({
  status,
  from,
  to,
}: RevaluationFilters) {
  return cursorListOptions(
    ["revaluations", "list", { status, from, to }],
    (cursor) =>
      unwrap(
        api.GET("/api/revaluations", {
          params: {
            query: {
              status,
              // The API takes a half-open interval of instants on `createdAt`; "to the 31st" ends where the 1st begins.
              createdFrom: from ? tashkentDayStart(from) : undefined,
              createdTo: to ? tashkentDayStart(nextDay(to)) : undefined,
              cursor,
              limit: 100,
            },
          },
        })
      )
  )
}

export function revaluationQuery(id: string) {
  return queryOptions({
    queryKey: ["revaluations", "one", id],
    queryFn: () =>
      unwrap(api.GET("/api/revaluations/{id}", { params: { path: { id } } })),
  })
}

/** After a write: the document from the answer; its list, and prices if it changed any, read again. */
function remember(queryClient: QueryClient, revaluation: Revaluation) {
  queryClient.setQueryData(
    revaluationQuery(revaluation.id).queryKey,
    revaluation
  )
  void queryClient.invalidateQueries({ queryKey: ["revaluations", "list"] })
  // A posted or reversed document changed prices, which every product card and list row carries.
  if (revaluation.status !== "DRAFT") {
    void queryClient.invalidateQueries({ queryKey: ["products"] })
    void queryClient.invalidateQueries({ queryKey: ["prices", "history"] })
  }
  return revaluation
}

const conflictKey = ["revaluations"]

export async function createRevaluation(
  queryClient: QueryClient,
  body: components["schemas"]["CreateRevaluationRequest"]
) {
  return remember(
    queryClient,
    await unwrap(api.POST("/api/revaluations", { body }))
  )
}

/** The lines are sent as a whole list and replace the draft's; the server fills each old price itself. */
export async function updateRevaluation(
  queryClient: QueryClient,
  draft: Pick<Revaluation, "id" | "version">,
  changes: Omit<components["schemas"]["UpdateRevaluationRequest"], "version">
) {
  return remember(
    queryClient,
    await readAgainOnConflict(
      queryClient,
      conflictKey,
      unwrap(
        api.PATCH("/api/revaluations/{id}", {
          params: { path: { id: draft.id } },
          body: { version: draft.version, ...changes },
        })
      )
    )
  )
}

export async function deleteRevaluation(
  queryClient: QueryClient,
  draft: Pick<Revaluation, "id" | "version">
) {
  await readAgainOnConflict(
    queryClient,
    conflictKey,
    unwrap(
      api.DELETE("/api/revaluations/{id}", {
        params: { path: { id: draft.id }, query: { version: draft.version } },
      })
    )
  )
  queryClient.removeQueries({ queryKey: revaluationQuery(draft.id).queryKey })
  void queryClient.invalidateQueries({ queryKey: ["revaluations", "list"] })
}

/** All changing lines apply at once, or none (409 `PRICES_CHANGED` when a current price moved meanwhile). */
export async function postRevaluation(
  queryClient: QueryClient,
  draft: Pick<Revaluation, "id" | "version">
) {
  return remember(
    queryClient,
    await readAgainOnConflict(
      queryClient,
      conflictKey,
      unwrap(
        api.POST("/api/revaluations/{id}/post", {
          params: { path: { id: draft.id } },
          body: { version: draft.version },
        })
      )
    )
  )
}

/** Takes the current prices as the lines' old prices, after `PRICES_CHANGED`. */
export async function refreshRevaluation(
  queryClient: QueryClient,
  draft: Pick<Revaluation, "id" | "version">
) {
  return remember(
    queryClient,
    await unwrap(
      api.POST("/api/revaluations/{id}/refresh", {
        params: { path: { id: draft.id } },
        body: { version: draft.version },
      })
    )
  )
}

/** Storno: the old prices come back, all or none (409 `PRICES_CHANGED_LATER` when a later document still stands). */
export async function reverseRevaluation(
  queryClient: QueryClient,
  posted: Pick<Revaluation, "id">
) {
  return remember(
    queryClient,
    await unwrap(
      api.POST("/api/revaluations/{id}/reverse", {
        params: { path: { id: posted.id } },
      })
    )
  )
}

export type ChangedPrice = components["schemas"]["PriceConflict"]

/** The prices that stopped a posting (`PRICES_CHANGED`) or a storno (`PRICES_CHANGED_LATER`). */
export function changedPrices(error: unknown): ChangedPrice[] {
  return (
    (
      problemWith(error, "PRICES_CHANGED") ??
      problemWith(error, "PRICES_CHANGED_LATER")
    )?.lines ?? []
  )
}
