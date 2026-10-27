import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { cursorListOptions } from "@/api/cursor-pages"
import type { components } from "@/api/schema"
import { readAgainOnConflict } from "@/api/writes"
import { isActiveFilter, type ActiveStatus } from "@/components/page"

export type Counterparty = components["schemas"]["CounterpartyResponse"]
export type CounterpartyChanges = Omit<
  components["schemas"]["UpdateCounterpartyRequest"],
  "version"
>

/** Who a counterparty is to the chain, as the URL keeps it (`?role=supplier`). */
export type CounterpartyRole = "supplier" | "customer"

export function parseCounterpartyRole(
  value: unknown
): CounterpartyRole | undefined {
  return value === "supplier" || value === "customer" ? value : undefined
}

/** The counterparties list's filters, as the URL keeps them (`/counterparties?role=customer&status=active`). */
export type CounterpartyFilters = {
  search?: string
  role?: CounterpartyRole
  status?: ActiveStatus
}

const apiRoles = { supplier: "SUPPLIER", customer: "CUSTOMER" } as const

const pageSize = 100

/**
 * One directory for the whole chain, read by everyone signed in (documents and the till pick from it). Without a
 * search: by name, page after page. With one: TradeNet answers its best matches in one page (a phone's or tax id's
 * digits, then names), so the list simply ends there.
 */
export function counterpartiesListOptions({
  search,
  role,
  status,
}: CounterpartyFilters) {
  return cursorListOptions(
    ["counterparties", "list", { search, role, status }],
    (cursor) =>
      unwrap(
        api.GET("/api/counterparties", {
          params: {
            query: {
              search,
              role: role ? apiRoles[role] : undefined,
              isActive: isActiveFilter(status),
              cursor,
              limit: pageSize,
            },
          },
        })
      )
  )
}

export function counterpartyQuery(id: string) {
  return queryOptions({
    queryKey: ["counterparties", "one", id],
    queryFn: () =>
      unwrap(api.GET("/api/counterparties/{id}", { params: { path: { id } } })),
  })
}

/** After a write: the card from the answer, the lists read again (a new name moves a row). */
function remember(queryClient: QueryClient, counterparty: Counterparty) {
  queryClient.setQueryData(
    counterpartyQuery(counterparty.id).queryKey,
    counterparty
  )
  void queryClient.invalidateQueries({ queryKey: ["counterparties", "list"] })
}

export async function createCounterparty(
  queryClient: QueryClient,
  body: components["schemas"]["CreateCounterpartyRequest"]
) {
  const counterparty = await unwrap(api.POST("/api/counterparties", { body }))
  remember(queryClient, counterparty)
  return counterparty
}

/** Fields left out stay; `""` removes an optional text, `priceType: {id: null}` removes the price type. */
export async function updateCounterparty(
  queryClient: QueryClient,
  counterparty: Pick<Counterparty, "id" | "version">,
  changes: CounterpartyChanges
) {
  const updated = await readAgainOnConflict(
    queryClient,
    ["counterparties"],
    unwrap(
      api.PATCH("/api/counterparties/{id}", {
        params: { path: { id: counterparty.id } },
        body: { version: counterparty.version, ...changes },
      })
    )
  )
  remember(queryClient, updated)
  return updated
}

/**
 * Nothing refers to a counterparty yet, so a delete succeeds; once documents do, TradeNet will refuse it and the
 * counterparty is deactivated instead.
 */
export async function deleteCounterparty(
  queryClient: QueryClient,
  counterparty: Pick<Counterparty, "id" | "version">
) {
  await readAgainOnConflict(
    queryClient,
    ["counterparties"],
    unwrap(
      api.DELETE("/api/counterparties/{id}", {
        params: {
          path: { id: counterparty.id },
          query: { version: counterparty.version },
        },
      })
    )
  )
  queryClient.removeQueries({
    queryKey: counterpartyQuery(counterparty.id).queryKey,
  })
  await queryClient.invalidateQueries({ queryKey: ["counterparties", "list"] })
}
