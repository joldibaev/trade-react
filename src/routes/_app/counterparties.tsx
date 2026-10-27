import { createFileRoute } from "@tanstack/react-router"

import { parseActiveStatus, parseSearchText } from "@/components/page"
import {
  parseCounterpartyRole,
  type CounterpartyFilters,
} from "@/features/counterparties/counterparties-api"
import { CounterpartiesPage } from "@/features/counterparties/counterparties-page"

export const Route = createFileRoute("/_app/counterparties")({
  validateSearch: (search: Record<string, unknown>): CounterpartyFilters => {
    const filters: CounterpartyFilters = {}
    const searchText = parseSearchText(search.search)
    if (searchText) filters.search = searchText
    const role = parseCounterpartyRole(search.role)
    if (role) filters.role = role
    const status = parseActiveStatus(search.status)
    if (status) filters.status = status
    return filters
  },
  component: function Counterparties() {
    return <CounterpartiesPage filters={Route.useSearch()} />
  },
})
